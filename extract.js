#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { gunzipSync } from 'fflate';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Get the directory name for the ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
    .option('all', {
        alias: 'a',
        type: 'boolean',
        description: 'Extract all .gz files'
    })
    .option('path', {
        alias: 'p',
        type: 'string',
        description: 'Extract files from a specific path'
    })
    .option('file', {
        alias: 'f',
        type: 'string',
        description: 'Extract a specific file'
    })
    .option('out', {
        alias: 'o',
        type: 'string',
        default: 'out',
        description: 'Output directory'
    })
    .help()
    .argv;

// Root directory for the Quran data
const ROOT_DIR = 'quran';
// Output directory
const OUT_DIR = argv.out;

/**
 * Find all files with a specific extension in a directory (recursive)
 * @param {string} dir - Directory to search
 * @param {string} ext - File extension to search for (e.g., '.gz')
 * @returns {Promise<string[]>} - Array of file paths
 */
async function findFiles(dir, ext) {
    let results = [];

    try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                // Recursively search subdirectories
                const subResults = await findFiles(fullPath, ext);
                results = results.concat(subResults);
            } else if (entry.isFile() && fullPath.endsWith(ext)) {
                // Add file if it has the right extension
                results.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error.message);
    }

    return results;
}

/**
 * Extract a gzipped file
 * @param {string} filePath - Path to the gzipped file
 * @param {string} outputPath - Path to extract the file to
 */
async function extractFile(filePath, outputPath) {
    try {
        console.log(`Extracting ${filePath} to ${outputPath}`);

        // Read the gzipped file
        const compressedData = await fs.readFile(filePath);

        // Decompress the data
        const decompressedData = gunzipSync(new Uint8Array(compressedData));

        // Convert to text
        const textDecoder = new TextDecoder('utf-8');
        const jsonString = textDecoder.decode(decompressedData);

        // Parse as JSON to validate and format
        const jsonData = JSON.parse(jsonString);

        // Ensure the output directory exists
        await fs.ensureDir(path.dirname(outputPath));

        // Write the JSON file
        await fs.writeFile(outputPath, JSON.stringify(jsonData, null, 2));

        console.log(`Successfully extracted ${path.basename(filePath)}`);
    } catch (error) {
        console.error(`Error extracting ${filePath}: ${error.message}`);
    }
}

/**
 * Extract all gzipped files in a directory
 * @param {string} dirPath - Directory to search for .gz files
 */
async function extractDirectory(dirPath) {
    try {
        // Find all .gz files in the directory and its subdirectories using our custom function
        const files = await findFiles(dirPath, '.gz');

        if (files.length === 0) {
            console.log(`No .gz files found in ${dirPath}`);
            return;
        }

        console.log(`Found ${files.length} .gz files in ${dirPath}`);

        // Process each file
        for (const file of files) {
            // Determine the output path
            // Preserve the directory structure under the 'out' directory
            const relativePath = path.relative(dirPath, file);
            const outputPath = path.join(OUT_DIR, relativePath).replace('.gz', '.json');

            await extractFile(file, outputPath);
        }

        console.log(`Extraction complete. Files saved to ${OUT_DIR} directory.`);
    } catch (error) {
        console.error(`Error extracting files: ${error.message}`);
    }
}

/**
 * Main function to run the extraction
 */
async function main() {
    try {
        // Check if the output directory exists, create it if not
        await fs.ensureDir(OUT_DIR);

        if (argv.all) {
            // Extract all files from the root directory
            await extractDirectory(ROOT_DIR);
        } else if (argv.path) {
            // Extract files from a specific path
            const extractPath = argv.path.startsWith(ROOT_DIR)
                ? argv.path
                : path.join(ROOT_DIR, argv.path);

            await extractDirectory(extractPath);
        } else if (argv.file) {
            // Extract a specific file
            const filePath = argv.file.endsWith('.gz')
                ? argv.file
                : `${argv.file}.gz`;

            const fullPath = filePath.startsWith(ROOT_DIR)
                ? filePath
                : path.join(ROOT_DIR, filePath);

            const outputPath = path.join(
                OUT_DIR,
                path.relative(ROOT_DIR, fullPath).replace('.gz', '.json')
            );

            await extractFile(fullPath, outputPath);
        } else {
            console.log(`
Please specify an extraction option:
  --all (-a): Extract all .gz files
  --path=PATH (-p PATH): Extract files from a specific path
  --file=FILE (-f FILE): Extract a specific file

Examples:
  node extract.js --all
  node extract.js --path=quran/translations/by-surah
  node extract.js --file=quran/translations/by-surah/1.gz
      `);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// Run the main function
main();