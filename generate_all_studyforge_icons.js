const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const PUBLIC_DIR = path.join(__dirname, 'public');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 1. MASTER SVG (512x512 - Visual Impression, Rich Palette)
function getMasterSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Deep Charcoal Background Gradient -->
    <radialGradient id="bg-grad" cx="50%" cy="38%" r="70%">
      <stop offset="0%" stop-color="#181A26" />
      <stop offset="55%" stop-color="#0F1017" />
      <stop offset="100%" stop-color="#07070B" />
    </radialGradient>

    <!-- Electric Indigo Left Blade -->
    <linearGradient id="left-blade" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818CF8" />
      <stop offset="50%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#4F46E5" />
    </linearGradient>

    <!-- Electric Indigo Right Blade -->
    <linearGradient id="right-blade" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="50%" stop-color="#4F46E5" />
      <stop offset="100%" stop-color="#3730A3" />
    </linearGradient>

    <!-- Apex Peak Crown Gradient -->
    <linearGradient id="apex-grad" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#EEF2FF" />
      <stop offset="50%" stop-color="#C7D2FE" />
      <stop offset="100%" stop-color="#818CF8" />
    </linearGradient>

    <!-- Base Chevron Foundation Gradient -->
    <linearGradient id="base-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4338CA" />
      <stop offset="100%" stop-color="#1E1B4B" />
    </linearGradient>

    <!-- Warm Amber Forged Ember Core Gradient -->
    <linearGradient id="amber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A" />
      <stop offset="35%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#B45309" />
    </linearGradient>

    <!-- Subtle Amber Glow Filter -->
    <filter id="ember-glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background Plate (Squircle Container) -->
  <rect width="512" height="512" rx="116" fill="url(#bg-grad)" />
  <rect width="506" height="506" x="3" y="3" rx="113" fill="none" stroke="#2A2E40" stroke-width="1.5" opacity="0.6" />

  <!-- SYMBOL GEOMETRY -->
  <g id="studyforge-symbol">
    <!-- 1. Apex Crown Peak (Upward Growth & Transformation) -->
    <polygon 
      points="256,64 300,108 256,152 212,108" 
      fill="url(#apex-grad)" 
    />

    <!-- 2. Left Monolith Blade (Technical Craftsmanship) -->
    <path 
      d="M 196,124 L 144,176 L 144,336 L 196,388 L 236,348 L 236,296 L 196,256 L 236,216 L 236,164 Z" 
      fill="url(#left-blade)" 
    />

    <!-- 3. Right Monolith Blade (Symmetrical Precision & Discipline) -->
    <path 
      d="M 316,124 L 368,176 L 368,336 L 316,388 L 276,348 L 276,296 L 316,256 L 276,216 L 276,164 Z" 
      fill="url(#right-blade)" 
    />

    <!-- 4. Lower Foundation Anchor (Bedrock & Focus) -->
    <polygon 
      points="256,364 316,424 256,456 196,424" 
      fill="url(#base-grad)" 
    />

    <!-- 5. Central Warm Amber Forged Ember (Intelligence & Energy Core) -->
    <g filter="url(#ember-glow)">
      <polygon 
        points="256,196 306,256 256,316 206,256" 
        fill="url(#amber-grad)"
      />
      <!-- Pure Inner Core Spark -->
      <polygon 
        points="256,224 282,256 256,288 230,256" 
        fill="#FFFFFF" 
        opacity="0.95"
      />
    </g>
  </g>
</svg>`;
}

// 2. SIMPLIFIED SVG FOR FAVICON (Ultra crisp line channels & high contrast at 16x16 / 32x32)
function getSimplifiedFaviconSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#0F1017" />
  
  <g>
    <!-- Apex Crown -->
    <polygon points="256,52 308,104 256,156 204,104" fill="#A5B4FC" />

    <!-- Left Wing -->
    <path d="M 188,120 L 132,176 L 132,336 L 188,392 L 232,348 L 232,292 L 188,256 L 232,220 L 232,164 Z" fill="#6366F1" />

    <!-- Right Wing -->
    <path d="M 324,120 L 380,176 L 380,336 L 324,392 L 280,348 L 280,292 L 324,256 L 280,220 L 280,164 Z" fill="#4F46E5" />

    <!-- Lower Base -->
    <polygon points="256,368 320,432 256,468 192,432" fill="#3730A3" />

    <!-- Central Amber Core Ember -->
    <polygon points="256,188 312,256 256,324 200,256" fill="#F59E0B" />
    <polygon points="256,220 284,256 256,292 228,256" fill="#FEF08A" />
  </g>
</svg>`;
}

// 3. MASKABLE SVG (Full Bleed Background, Icon scaled to ~62% inside safe zone)
function getMaskableSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="mask-bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#181A26" />
      <stop offset="60%" stop-color="#0F1017" />
      <stop offset="100%" stop-color="#07070B" />
    </radialGradient>

    <linearGradient id="m-left-blade" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818CF8" />
      <stop offset="100%" stop-color="#4F46E5" />
    </linearGradient>
    <linearGradient id="m-right-blade" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#3730A3" />
    </linearGradient>
    <linearGradient id="m-apex" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#EEF2FF" />
      <stop offset="100%" stop-color="#818CF8" />
    </linearGradient>
    <linearGradient id="m-amber" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FEF08A" />
      <stop offset="50%" stop-color="#F59E0B" />
      <stop offset="100%" stop-color="#B45309" />
    </linearGradient>
  </defs>

  <!-- Full Bleed Square (Required for Maskable icons) -->
  <rect width="512" height="512" fill="url(#mask-bg)" />

  <!-- Scaled Icon inside Safe Zone (Scaled 0.65 centered) -->
  <g transform="translate(256, 256) scale(0.66) translate(-256, -256)">
    <polygon points="256,64 300,108 256,152 212,108" fill="url(#m-apex)" />
    <path d="M 196,124 L 144,176 L 144,336 L 196,388 L 236,348 L 236,296 L 196,256 L 236,216 L 236,164 Z" fill="url(#m-left-blade)" />
    <path d="M 316,124 L 368,176 L 368,336 L 316,388 L 276,348 L 276,296 L 316,256 L 276,216 L 276,164 Z" fill="url(#m-right-blade)" />
    <polygon points="256,364 316,424 256,456 196,424" fill="#3730A3" />
    <polygon points="256,196 306,256 256,316 206,256" fill="url(#m-amber)" />
    <polygon points="256,224 282,256 256,288 230,256" fill="#FFFFFF" />
  </g>
</svg>`;
}

// 4. MONOCHROME SVG (Single-color flat vector symbol)
function getMonochromeSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g fill="currentColor">
    <!-- Apex Peak -->
    <polygon points="256,64 300,108 256,152 212,108" />
    
    <!-- Left Blade -->
    <path d="M 196,124 L 144,176 L 144,336 L 196,388 L 236,348 L 236,296 L 196,256 L 236,216 L 236,164 Z" />
    
    <!-- Right Blade -->
    <path d="M 316,124 L 368,176 L 368,336 L 316,388 L 276,348 L 276,296 L 316,256 L 276,216 L 276,164 Z" />
    
    <!-- Lower Base Anchor -->
    <polygon points="256,364 316,424 256,456 196,424" />
    
    <!-- Central Ember Core -->
    <polygon points="256,196 306,256 256,316 206,256" />
  </g>
</svg>`;
}

// ICO Builder function (packages multiple PNG buffers into standard ICO format)
function createIco(pngBuffers) {
  // Header: 6 bytes
  const count = pngBuffers.length;
  const headerLen = 6 + count * 16;
  let dataOffset = headerLen;

  const dirEntries = [];
  for (let i = 0; i < count; i++) {
    const { width, height, data } = pngBuffers[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(data.length, 8); // size
    entry.writeUInt32LE(dataOffset, 12); // offset
    dirEntries.push(entry);
    dataOffset += data.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4);

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map(b => b.data)]);
}

// Generate all assets
async function buildAll() {
  console.log('Generating StudyForge SVG assets...');
  
  const masterSvg = getMasterSVG();
  const simplifiedSvg = getSimplifiedFaviconSVG();
  const maskableSvg = getMaskableSVG();
  const monochromeSvg = getMonochromeSVG();

  // Save SVG Files
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.svg'), masterSvg);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'studyforge-symbol.svg'), masterSvg);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), simplifiedSvg);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'maskable.svg'), maskableSvg);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-monochrome.svg'), monochromeSvg);

  console.log('Rendering PNG icons at required sizes...');

  // Helper to render SVG to PNG buffer using Resvg
  function renderPng(svgContent, width, height = width) {
    const resvg = new Resvg(svgContent, {
      fitTo: { mode: 'width', value: width }
    });
    return resvg.render().asPng();
  }

  // 1. Favicon PNGs (Use simplified SVG for crisp small-scale rendering)
  const png16 = renderPng(simplifiedSvg, 16);
  const png32 = renderPng(simplifiedSvg, 32);
  const png48 = renderPng(simplifiedSvg, 48);
  const png64 = renderPng(masterSvg, 64);

  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-16.png'), png16);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-32.png'), png32);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon-64.png'), png64);

  // 2. Favicon ICO (16, 32, 48)
  const icoBuffer = createIco([
    { width: 16, height: 16, data: png16 },
    { width: 32, height: 32, data: png32 },
    { width: 48, height: 48, data: png48 },
  ]);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);

  // 3. Apple Touch Icon (180x180)
  const png180 = renderPng(masterSvg, 180);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), png180);

  // 4. PWA 192 Icon (192x192)
  const png192 = renderPng(masterSvg, 192);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-192.png'), png192);

  // 5. PWA 512 Icon (512x512)
  const png512 = renderPng(masterSvg, 512);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-512.png'), png512);

  // 6. Maskable PWA Icon (512x512)
  const maskablePng = renderPng(maskableSvg, 512);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'maskable-512.png'), maskablePng);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-maskable.png'), maskablePng);

  console.log('✅ ALL STUDYFORGE ICON ASSETS GENERATED SUCCESSFULLY!');
}

buildAll().catch(err => {
  console.error('Error generating icon assets:', err);
  process.exit(1);
});
