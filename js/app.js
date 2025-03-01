// Import fflate and JSON formatter from CDN
import * as fflate from 'https://cdn.skypack.dev/fflate@0.8.2?min';
import JSONFormatter from 'https://cdn.skypack.dev/json-formatter-js@2.3.4?min';

// Main application
(async function() {
    const contentContainer = document.getElementById('content-container');
    const ROOT_DIR = 'quran'; // Define the root directory

    // Helper function to clean paths and prevent duplication
    function cleanPath(path) {
        // If path starts with a leading slash, remove it
        path = path.replace(/^\/+/, '');

        // If we see patterns like "quran/quran/..." reduce to just "quran/..."
        if (path.match(new RegExp(`^${ROOT_DIR}/${ROOT_DIR}`))) {
            path = path.replace(new RegExp(`^${ROOT_DIR}/${ROOT_DIR}`), ROOT_DIR);
        }

        // Make sure path starts with ROOT_DIR
        if (!path.startsWith(ROOT_DIR)) {
            path = `${ROOT_DIR}/${path}`;
        }

        // Remove any double slashes and trailing slash
        return path.replace(/\/+/g, '/').replace(/\/$/, '');
    }

    // Function to extract basename from path
    function basename(path) {
        const parts = path.split('/');
        return parts[parts.length - 1];
    }

    // Function to auto-detect files and folders in directory
    async function detectDirectoryContents(dirPath) {
        try {
            contentContainer.innerHTML = '<div class="loading">Reading directory contents...</div>';

            // Ensure dirPath has a trailing slash for directory listing
            const fetchPath = dirPath.endsWith('/') ? dirPath : dirPath + '/';

            // Try to fetch the directory listing
            const response = await fetch(fetchPath);
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

            // Extract current directory name from the path
            const pathParts = dirPath.split('/');
            const currentDir = pathParts[pathParts.length - 1].replace(/\/$/, '');

            // Process links
            for (const link of links) {
                const href = link.getAttribute('href');
                const text = link.textContent.trim();

                // Skip parent directory links and empty links
                if (!href || href === '../' || href === './' || href === '/' || text === 'Parent Directory' || text === '../') {
                    continue;
                }

                // Get clean name from href (without trailing slash)
                const rawName = href.replace(/\/$/, '');
                const dirName = basename(rawName);

                // Skip if this is the root directory or current directory
                if (dirName === ROOT_DIR || dirName === currentDir) {
                    continue;
                }

                // Check if it's a directory (typically ends with a slash)
                const isDirectory = href.endsWith('/');

                if (isDirectory) {
                    items.directories.push({
                        name: dirName,
                        href: href
                    });
                } else if (href.endsWith('.gz')) {
                    // Get just the file name without path
                    const fileName = basename(href);

                    items.files.push({
                        name: fileName,
                        href: href
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
        // Normalize the path
        path = cleanPath(path);

        // Log the path for debugging
        console.log(`Displaying directory: ${path}`);

        // Prepare fetch path - ensure it points to the correct directory
        let fetchPath;

        // Always fetch from the correct directory
        if (path === ROOT_DIR) {
            fetchPath = ROOT_DIR + '/';
        } else {
            fetchPath = path + '/';
        }

        // Get directory contents
        const contents = await detectDirectoryContents(fetchPath);

        // Get the current directory name for display
        const currentDirName = basename(path);

        let html = `
            <div class="directory">
                <h2><span class="folder-icon">📁</span> ${currentDirName}</h2>
        `;

        // Add breadcrumb navigation
        html += '<div class="breadcrumb">';

        // Add home link to quran
        html += `<a href="#${ROOT_DIR}"><span class="home-icon">🏠</span> Home</a>`;

        // Build breadcrumb path
        if (path !== ROOT_DIR) {
            const pathParts = path.split('/');
            let breadcrumbPath = '';

            for (let i = 0; i < pathParts.length; i++) {
                breadcrumbPath += (breadcrumbPath ? '/' : '') + pathParts[i];
                const isLast = i === pathParts.length - 1;

                if (isLast) {
                    html += ` / <span class="current">${pathParts[i]}</span>`;
                } else {
                    html += ` / <a href="#${breadcrumbPath}">${pathParts[i]}</a>`;
                }
            }
        }

        html += '</div>';

        // Add directories section if any
        if (contents.directories.length > 0) {
            html += '<h3>Folders</h3>';
            html += '<div class="folder-list">';

            contents.directories.forEach(dir => {
                // Build proper hash path
                let dirPath;

                // Build the path from current location
                dirPath = cleanPath(`${path}/${dir.name}`);

                // Log the directory path being built
                console.log(`Building dir link: ${dir.name} → ${dirPath}`);

                html += `
                    <a href="#${dirPath}" class="item folder-item">
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
                // Build proper hash path
                let filePath;

                // Build the path from current location
                filePath = `${path}/${file.name}`;

                // Log the file path being built
                console.log(`Building file link: ${file.name} → ${filePath}`);

                html += `
                    <a href="#${filePath}" class="item file-item">
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
            // Construct the full path if needed
            let fetchPath = path;
            if (!fetchPath.startsWith(ROOT_DIR + '/') && fetchPath !== ROOT_DIR) {
                fetchPath = ROOT_DIR + '/' + path;
            }

            // Fetch the .gz file
            const response = await fetch(fetchPath);
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

            // Get the directory path for the back button
            let dirPath = pathParts.join('/');
            if (!dirPath) {
                dirPath = ROOT_DIR;
            } else if (!dirPath.startsWith(ROOT_DIR)) {
                dirPath = ROOT_DIR + '/' + dirPath;
            }

            // Clean the dirPath to prevent issues when going back
            dirPath = cleanPath(dirPath);

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
            // Redirect to quran directory if no hash
            window.location.hash = ROOT_DIR;
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