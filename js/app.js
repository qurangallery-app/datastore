// Import fflate and JSON formatter from CDN
import * as fflate from 'https://cdn.skypack.dev/fflate@0.8.2?min';
import JSONFormatter from 'https://cdn.skypack.dev/json-formatter-js@2.3.4?min';

// Main application
(async function() {
    const contentContainer = document.getElementById('content-container');

    // Function to auto-detect files and folders in directory
    async function detectDirectoryContents(dirPath) {
        try {
            contentContainer.innerHTML = '<div class="loading">Reading directory contents...</div>';

            // Try to fetch the directory listing
            const response = await fetch(dirPath);
            const html = await response.text();

            // Parse the HTML to find links
            const tempElement = document.createElement('div');
            tempElement.innerHTML = html;

            // Get all links
            const links = tempElement.querySelectorAll('a');
            const items = {
                directories: [],
                files: []
            };

            // Process links
            for (const link of links) {
                const href = link.getAttribute('href');
                const text = link.textContent.trim();

                // Skip parent directory links and empty links
                if (!href || href === '../' || href === './' || href === '/' || text === 'Parent Directory' || text === '../') {
                    continue;
                }

                // Check if it's a directory (typically ends with a slash)
                const isDirectory = href.endsWith('/');

                if (isDirectory) {
                    // Remove trailing slash for display
                    const dirName = href.replace(/\/$/, '');
                    items.directories.push({
                        name: dirName,
                        path: `${dirPath}${href}`
                    });
                } else if (href.endsWith('.gz')) {
                    // It's a .gz file
                    items.files.push({
                        name: href,
                        path: `${dirPath}${href}`
                    });
                }
            }

            return items;
        } catch (error) {
            console.error('Error detecting directory contents:', error);
            return { directories: [], files: [] };
        }
    }

    // Function to display directory contents
    async function displayDirectory(path) {
        // Ensure path ends with a slash for directory URLs
        if (path && !path.endsWith('/')) {
            path += '/';
        }

        // Get the path for navigation
        const pathForDisplay = path.replace(/\/$/, ''); // Remove trailing slash
        const pathParts = pathForDisplay.split('/');
        const currentDirName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'Root';

        // Detect directory contents
        const contents = await detectDirectoryContents(path);

        let html = `
            <div class="directory">
                <h2><span class="folder-icon">📁</span> ${currentDirName}</h2>
        `;

        // Add breadcrumb navigation
        if (pathParts.length > 0) {
            html += '<div class="breadcrumb">';

            // Add link to root
            html += '<a href="#"><span class="home-icon">🏠</span> Home</a>';

            // Build the path progressively
            let cumulativePath = '';
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                if (part) {
                    cumulativePath += (cumulativePath ? '/' : '') + part;
                    const isLast = i === pathParts.length - 1;

                    if (isLast) {
                        html += ` / <span class="current">${part}</span>`;
                    } else {
                        html += ` / <a href="#${cumulativePath}">${part}</a>`;
                    }
                }
            }

            html += '</div>';
        }

        // Add directories section if any
        if (contents.directories.length > 0) {
            html += '<h3>Folders</h3>';
            html += '<div class="folder-list">';

            contents.directories.forEach(dir => {
                // Create a hash path without the trailing slash
                const hashPath = dir.path.replace(/^\.\//g, ''); // Remove leading './'

                html += `
                    <a href="#${hashPath}" class="item folder-item">
                        <span class="icon">📁</span>
                        <span class="name">${dir.name}</span>
                    </a>
                `;
            });

            html += '</div>';
        }

        // Add files section if any
        if (contents.files.length > 0) {
            html += '<h3>Files</h3>';
            html += '<div class="file-list">';

            contents.files.forEach(file => {
                // Create a hash path
                const hashPath = file.path.replace(/^\.\//g, ''); // Remove leading './'

                html += `
                    <a href="#${hashPath}" class="item file-item">
                        <span class="icon">📄</span>
                        <span class="name">${file.name.replace('.gz', '')}</span>
                    </a>
                `;
            });

            html += '</div>';
        }

        // If no items found
        if (contents.directories.length === 0 && contents.files.length === 0) {
            html += `
                <div class="no-items">
                    <p>No items found in this directory.</p>
                    <p>Make sure directory listing is enabled on your server.</p>
                </div>
            `;
        }

        html += '</div>';
        contentContainer.innerHTML = html;
    }

    // Function to load and display a .gz file
    async function loadGzFile(path) {
        contentContainer.innerHTML = '<div class="loading">Loading file...</div>';

        try {
            // Fetch the .gz file
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to load file: ${response.status}`);
            }

            // Get file content as ArrayBuffer
            const arrayBuffer = await response.arrayBuffer();
            const compressedData = new Uint8Array(arrayBuffer);

            // Decompress with fflate
            const decompressedData = fflate.gunzipSync(compressedData);

            // Convert to text and parse as JSON
            const textDecoder = new TextDecoder('utf-8');
            const jsonString = textDecoder.decode(decompressedData);
            const jsonData = JSON.parse(jsonString);

            // Extract filename and directory path
            const pathParts = path.split('/');
            const filename = pathParts.pop();
            const dirPath = pathParts.join('/');

            // Create HTML structure
            let html = `
                <div class="file-view">
                    <div class="file-header">
                        <div class="directory-name">
                            <span class="folder-icon">📁</span> ${dirPath}
                        </div>
                        <h2>
                            <span class="file-icon">📄</span> ${filename.replace('.gz', '')}
                        </h2>
                        <button onclick="window.location.hash = '${dirPath}'">Back to Directory</button>
                    </div>
                    <div id="json-content" class="json-content"></div>
                </div>
            `;

            contentContainer.innerHTML = html;

            // Add JSON formatter
            const jsonContainer = document.getElementById('json-content');
            const formatter = new JSONFormatter(jsonData, 2, {
                hoverPreviewEnabled: true,
                animateOpen: true,
                animateClose: true
            });

            // Add controls
            const controls = document.createElement('div');
            controls.className = 'json-controls';

            const expandBtn = document.createElement('button');
            expandBtn.textContent = 'Expand All';
            expandBtn.onclick = () => formatter.openAtDepth(Infinity);

            const collapseBtn = document.createElement('button');
            collapseBtn.textContent = 'Collapse All';
            collapseBtn.onclick = () => formatter.openAtDepth(1);

            controls.appendChild(expandBtn);
            controls.appendChild(collapseBtn);

            jsonContainer.appendChild(controls);
            jsonContainer.appendChild(formatter.render());

        } catch (error) {
            contentContainer.innerHTML = `
                <div class="error">
                    <h2>Error Loading File</h2>
                    <p>${error.message}</p>
                    <button onclick="history.back()">Go Back</button>
                </div>
            `;
        }
    }

    // Router to handle URL paths
    function handleRoute() {
        const hash = window.location.hash.substring(1);

        if (!hash || hash === '') {
            // Show root directory (which should include quran)
            displayDirectory('./');
            return;
        }

        if (hash.endsWith('.gz')) {
            // Load .gz file
            loadGzFile(hash);
        } else {
            // It's a directory
            displayDirectory(hash);
        }
    }

    // Set up router
    window.addEventListener('hashchange', handleRoute);

    // Initial route handling
    handleRoute();
})();