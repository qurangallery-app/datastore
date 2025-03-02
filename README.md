# Quran File Extractor

This Node.js utility extracts gzipped JSON files from the Quran dataset to an output directory.

## Installation

1. Clone or download this repository
2. Install dependencies:

```bash
npm install
```

## Usage

The extractor provides several options for extracting files:

### Extract all files

```bash
npm run extract:all
```

Or:

```bash
node extract.js --all
```

### Extract files from a specific path

```bash
node extract.js --path=quran/translations/by-surah
```

Or with custom output directory:

```bash
node extract.js --path=quran/translations/by-surah --out=custom-output
```

### Extract a specific file

```bash
node extract.js --file=quran/translations/by-surah/1.gz
```

## Command Line Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--all` | `-a` | Extract all .gz files | - |
| `--path=PATH` | `-p PATH` | Extract files from a specific path | - |
| `--file=FILE` | `-f FILE` | Extract a specific file | - |
| `--out=DIR` | `-o DIR` | Set custom output directory | `out` |
| `--help` | - | Show help information | - |

## Output

Extracted files will be saved to the `out` directory by default, preserving the original directory structure. The extracted files will be formatted JSON with the `.json` extension.

## Examples

### Extract translations for a specific surah

```bash
node extract.js --path=quran/translations/by-surah/1
```

### Extract word-by-word data

```bash
node extract.js --path=quran/word-by-word
```

### Extract to a custom output directory

```bash
node extract.js --all --out=extracted-data
```



```angular2html
# Compress a directory
bun archiver.ts compress tafsirs

# Uncompress an archive
bun archiver.ts uncompress tafsirs.bunz
```