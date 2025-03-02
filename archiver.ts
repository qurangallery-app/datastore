#!/usr/bin/env bun
// archiver.ts - A utility for compressing and extracting directories using Bun

import { readdir, stat } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { argv } from 'process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { BunFile } from 'bun';
import { gunzipSync, gzipSync } from 'zlib';

// Command line arguments
const args = argv.slice(2);
const flags = args.filter(arg => arg.startsWith('-'));
const positionalArgs = args.filter(arg => !arg.startsWith('-'));

// Check for help flag
if (flags.includes('-h') || flags.includes('--help') || args.length === 0) {
  console.log(`
Usage: bun archiver.ts [options] <command> <arguments>

Commands:
  compress <directory-path> [output-file.bunz]  Compress a directory
  uncompress <archive-file> [output-directory]  Uncompress an archive

Options:
  -l, --level=N      Compression level (1-9, default: 9)
  -v, --verbose      Show detailed information
  -h, --help         Show this help message
  `);
  process.exit(0);
}

// Parse options
const isVerbose = flags.includes('-v') || flags.includes('--verbose');
const compressionLevelArg = flags.find(arg => arg.startsWith('--level=') || arg.startsWith('-l='));
const level = compressionLevelArg
    ? parseInt(compressionLevelArg.split('=')[1]) || 9
    : 9;

// Get command and required arguments
const command = positionalArgs[0];
const inputPath = positionalArgs[1];
const outputPath = positionalArgs[2];

// Default extension for our archives
const DEFAULT_EXTENSION = '.bunz';

if (!command) {
  console.error('Error: No command specified. Use "compress" or "uncompress".');
  process.exit(1);
}

if (!inputPath) {
  console.error('Error: No input path specified.');
  process.exit(1);
}

/**
 * Recursively read all files from a directory
 * @param {string} dir - Directory path to read
 * @param {string} [baseDir] - Base directory for relative paths
 * @returns {Promise<{[key: string]: Uint8Array}>} - Object with relative paths and file contents
 */
async function readFilesRecursively(dir, baseDir = dir) {
  const files = {};
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = fullPath.slice(baseDir.length + 1);

    if (entry.isDirectory()) {
      const subDirFiles = await readFilesRecursively(fullPath, baseDir);
      Object.assign(files, subDirFiles);
    } else {
      const content = await Bun.file(fullPath).arrayBuffer();
      files[relativePath] = new Uint8Array(content);
    }
  }

  return files;
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Ensure directory exists, create it if it doesn't
 * @param {string} dirPath - Directory path to ensure
 */
function ensureDirectoryExists(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Convert text to Uint8Array
 * @param {string} text - Text to convert
 * @returns {Uint8Array} - Resulting array
 */
function textToUint8Array(text) {
  return new TextEncoder().encode(text);
}

/**
 * Convert Uint8Array to text
 * @param {Uint8Array} array - Array to convert
 * @returns {string} - Resulting text
 */
function uint8ArrayToText(array) {
  return new TextDecoder().decode(array);
}

/**
 * Compress a directory to a custom archive
 * @param {string} directoryPath - Path to the directory to compress
 * @param {string} [outputFile] - Path to the output file
 */
async function compressDirectory(directoryPath, outputFile) {
  try {
    // Ensure the directory exists
    const dirStats = await stat(directoryPath);
    if (!dirStats.isDirectory()) {
      console.error(`Error: '${directoryPath}' is not a directory.`);
      process.exit(1);
    }

    // Set default output file if not provided
    outputFile = outputFile || `${basename(directoryPath)}${DEFAULT_EXTENSION}`;

    console.log(`Reading files from ${directoryPath}...`);
    const files = await readFilesRecursively(directoryPath);
    const fileCount = Object.keys(files).length;

    if (fileCount === 0) {
      console.error(`Error: No files found in '${directoryPath}'.`);
      process.exit(1);
    }

    if (isVerbose) {
      console.log(`Files to compress:`);
      Object.keys(files).forEach(file => {
        console.log(`- ${file} (${formatSize(files[file].length)})`);
      });
    }

    console.log(`Creating archive with ${fileCount} files...`);

    // Create archive structure
    const archive = {
      version: '1.0',
      created: new Date().toISOString(),
      files: Object.keys(files).map(path => ({
        path,
        size: files[path].length
      }))
    };

    // Serialize archive metadata
    const metadataJson = JSON.stringify(archive);
    const metadataBuffer = textToUint8Array(metadataJson);

    // Calculate total size
    const totalContentSize = Object.values(files).reduce((sum, content) => sum + content.length, 0);

    // Combine file data
    const contentBuffers = [];
    for (const filePath of Object.keys(files).sort()) {
      const pathBuffer = textToUint8Array(filePath);
      const content = files[filePath];

      // Store path length (4 bytes) + path + content length (4 bytes) + content
      const headerBuffer = new ArrayBuffer(8);
      const headerView = new DataView(headerBuffer);
      headerView.setUint32(0, pathBuffer.length, true);
      headerView.setUint32(4, content.length, true);

      contentBuffers.push(
          new Uint8Array(headerBuffer),
          pathBuffer,
          content
      );
    }

    // Create header (4 bytes for metadata length)
    const headerBuffer = new ArrayBuffer(4);
    const headerView = new DataView(headerBuffer);
    headerView.setUint32(0, metadataBuffer.length, true);

    // Combine all parts
    const allBuffers = [
      new Uint8Array(headerBuffer),
      metadataBuffer,
      ...contentBuffers
    ];

    // Calculate total length
    const totalLength = allBuffers.reduce((sum, buffer) => sum + buffer.length, 0);

    // Create final buffer
    const finalBuffer = new Uint8Array(totalLength);
    let offset = 0;

    for (const buffer of allBuffers) {
      finalBuffer.set(buffer, offset);
      offset += buffer.length;
    }

    console.log(`Compressing data (level: ${level})...`);

    // Compress with zlib
    const compressed = gzipSync(finalBuffer, { level });

    // Write to file
    writeFileSync(outputFile, compressed);

    // Calculate compression ratio
    const originalSize = totalContentSize + metadataBuffer.length;
    const compressedSize = compressed.length;
    const ratio = ((1 - (compressedSize / originalSize)) * 100).toFixed(2);

    console.log(`Successfully compressed ${fileCount} files to '${outputFile}'`);
    console.log(`Original size: ${formatSize(originalSize)}`);
    console.log(`Compressed size: ${formatSize(compressedSize)}`);
    console.log(`Compression ratio: ${ratio}% saved`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Uncompress an archive to a directory
 * @param {string} archivePath - Path to the archive to uncompress
 * @param {string} [outputDir] - Path to the output directory
 */
async function uncompressArchive(archivePath, outputDir) {
  try {
    // Ensure the archive exists
    const archiveStats = await stat(archivePath);
    if (!archiveStats.isFile()) {
      console.error(`Error: '${archivePath}' is not a file.`);
      process.exit(1);
    }

    // Set default output directory if not provided
    if (!outputDir) {
      const baseName = basename(archivePath, DEFAULT_EXTENSION);
      outputDir = join(dirname(archivePath), baseName);
    }

    // Ensure output directory exists
    ensureDirectoryExists(outputDir);

    console.log(`Reading archive ${archivePath}...`);
    const archiveData = readFileSync(archivePath);

    console.log(`Decompressing data...`);
    const decompressed = gunzipSync(archiveData);

    // Read metadata length
    const headerView = new DataView(decompressed.buffer, decompressed.byteOffset, 4);
    const metadataLength = headerView.getUint32(0, true);

    // Read metadata
    const metadataBuffer = decompressed.subarray(4, 4 + metadataLength);
    const metadataJson = uint8ArrayToText(metadataBuffer);
    const metadata = JSON.parse(metadataJson);

    if (!metadata.files || !Array.isArray(metadata.files)) {
      console.error('Error: Invalid archive format.');
      process.exit(1);
    }

    const fileCount = metadata.files.length;
    if (fileCount === 0) {
      console.error(`Error: No files found in the archive.`);
      process.exit(1);
    }

    console.log(`Extracting ${fileCount} files...`);

    // Extract files
    let offset = 4 + metadataLength;
    let totalExtractedSize = 0;

    while (offset < decompressed.length) {
      // Read header
      const fileHeaderView = new DataView(decompressed.buffer, decompressed.byteOffset + offset, 8);
      const pathLength = fileHeaderView.getUint32(0, true);
      const contentLength = fileHeaderView.getUint32(4, true);
      offset += 8;

      // Read path
      const pathBuffer = decompressed.subarray(offset, offset + pathLength);
      const path = uint8ArrayToText(pathBuffer);
      offset += pathLength;

      // Read content
      const content = decompressed.subarray(offset, offset + contentLength);
      offset += contentLength;

      // Write file
      const fullPath = join(outputDir, path);
      const fileDir = dirname(fullPath);

      // Ensure the parent directory exists
      ensureDirectoryExists(fileDir);

      // Write the file
      writeFileSync(fullPath, content);
      totalExtractedSize += content.length;

      if (isVerbose) {
        console.log(`Extracted: ${path} (${formatSize(content.length)})`);
      }
    }

    console.log(`Successfully extracted ${fileCount} files to '${outputDir}'`);
    console.log(`Total extracted size: ${formatSize(totalExtractedSize)}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Execute the appropriate command
if (command === 'compress') {
  compressDirectory(inputPath, outputPath);
} else if (command === 'uncompress') {
  uncompressArchive(inputPath, outputPath);
} else {
  console.error(`Error: Unknown command '${command}'. Use "compress" or "uncompress".`);
  process.exit(1);
}