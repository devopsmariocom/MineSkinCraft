import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PixelEditor } from './pixelEditor.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// UI elements
const colorPicker = document.getElementById('colorPicker');
const saveBtn = document.getElementById('saveBtn');
const exportTemplateBtn = document.getElementById('exportTemplateBtn');
const editPixelsBtn = document.getElementById('editPixelsBtn');
let selectedMesh = null;

// Initialize the pixel editor
const pixelEditor = new PixelEditor();

// Store the last generated template
let lastTemplateDataURL = null;

const parts = [];
const partColors = {};

function createPart(name, x, y, z, w, h, d, color) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const savedColor = localStorage.getItem(`part_${name}`);

  // Create a canvas texture for this part
  const textureSize = 64;
  const canvas = document.createElement('canvas');
  canvas.width = textureSize;
  canvas.height = textureSize;
  const ctx = canvas.getContext('2d');

  // Fill with the base color
  ctx.fillStyle = savedColor || `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, textureSize, textureSize);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  // Create material with the texture
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff // White color to not affect the texture
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.name = name;

  // Store the canvas and context for later pixel editing
  mesh.userData = {
    canvas: canvas,
    context: ctx,
    texture: texture,
    baseColor: savedColor ? new THREE.Color(savedColor) : new THREE.Color(color)
  };

  scene.add(mesh);
  parts.push(mesh);

  // Store the color for template generation
  partColors[name] = savedColor ? new THREE.Color(savedColor) : new THREE.Color(color);

  return mesh;
}

// Create character parts
createPart("hlava", 0, 2.5, 0, 1, 1, 1, 0xffccaa);
createPart("telo", 0, 1, 0, 1, 2, 0.5, 0x00aa00);
createPart("rukaL", -0.75, 1.25, 0, 0.5, 1.5, 0.5, 0x0000ff);
createPart("rukaP", 0.75, 1.25, 0, 0.5, 1.5, 0.5, 0x0000ff);
createPart("nohaL", -0.25, -0.5, 0, 0.5, 1.5, 0.5, 0x000000);
createPart("nohaP", 0.25, -0.5, 0, 0.5, 1.5, 0.5, 0x000000);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 5, 5).normalize();
scene.add(light);

// Add ambient light to better see the model
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

camera.position.z = 5;

// Raycaster for selection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Variables for pixel painting
let isPainting = false;
let currentBrushSize = 2;
let editingMode = 'color'; // 'color' or 'pixel'

// Function to paint a pixel on the 3D model
function paintPixelOnModel(mesh, intersect, color) {
  if (!mesh || !mesh.userData.canvas) return;

  // Get the UV coordinates at the intersection point
  const uv = intersect.uv;
  if (!uv) return;

  const canvas = mesh.userData.canvas;
  const ctx = mesh.userData.context;
  const texture = mesh.userData.texture;

  // Convert UV coordinates to pixel coordinates
  const x = Math.floor(uv.x * canvas.width);
  const y = Math.floor((1 - uv.y) * canvas.height);

  // Draw a pixel at the intersection point
  ctx.fillStyle = color;

  // Draw a circle with the current brush size
  ctx.beginPath();
  ctx.arc(x, y, currentBrushSize, 0, Math.PI * 2);
  ctx.fill();

  // Update the texture
  texture.needsUpdate = true;

  // Reset the template since we've made changes
  lastTemplateDataURL = null;
}

// Handle mouse events for pixel painting
window.addEventListener('mousedown', (event) => {
  // Only handle if we're in pixel editing mode
  if (editingMode !== 'pixel') return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(parts);

  if (intersects.length > 0) {
    isPainting = true;
    selectedMesh = intersects[0].object;
    paintPixelOnModel(selectedMesh, intersects[0], colorPicker.value);
  }
});

window.addEventListener('mousemove', (event) => {
  if (!isPainting || editingMode !== 'pixel') return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects([selectedMesh]);

  if (intersects.length > 0) {
    paintPixelOnModel(selectedMesh, intersects[0], colorPicker.value);
  }
});

window.addEventListener('mouseup', () => {
  isPainting = false;
});

// Regular click handler for color mode
window.addEventListener('click', (event) => {
  // Ignore clicks if the pixel editor is open
  if (document.getElementById('pixelEditorContainer').style.display === 'flex') return;

  // If we're in pixel editing mode, this is handled by the mousedown/move/up events
  if (editingMode === 'pixel') return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(parts);

  if (intersects.length > 0) {
    selectedMesh = intersects[0].object;

    if (editingMode === 'color') {
      // In color mode, change the entire part color
      const colorValue = colorPicker.value;

      // Update the canvas with the new color
      const canvas = selectedMesh.userData.canvas;
      const ctx = selectedMesh.userData.context;
      const texture = selectedMesh.userData.texture;

      ctx.fillStyle = colorValue;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      texture.needsUpdate = true;

      // Store the color
      localStorage.setItem(`part_${selectedMesh.name}`, colorValue);

      // Update the color in our partColors object
      partColors[selectedMesh.name] = new THREE.Color(colorValue);
      selectedMesh.userData.baseColor = new THREE.Color(colorValue);

      // Reset the last template since colors have changed
      lastTemplateDataURL = null;
    }
  }
});

saveBtn.addEventListener('click', () => {
  renderer.render(scene, camera);
  const link = document.createElement('a');
  link.download = 'minecraft-skin.png';
  link.href = renderer.domElement.toDataURL();
  link.click();
});

// Function to generate a Minecraft skin template
function generateSkinTemplate() {
  // Create a canvas with the standard Minecraft skin dimensions (64x64)
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Fill with transparent background
  ctx.clearRect(0, 0, 64, 64);

  // Helper function to convert THREE.Color to CSS color string
  function colorToCSS(color) {
    return `rgb(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)})`;
  }

  // Helper function to draw a face with optional details
  function drawFace(x, y, width, height, color, details = null) {
    ctx.fillStyle = colorToCSS(color);
    ctx.fillRect(x, y, width, height);

    if (details) {
      // Draw details like eyes, mouth, etc.
      ctx.fillStyle = details.color;
      if (details.type === 'eyes') {
        // Simple eyes (for head front face)
        ctx.fillRect(x + Math.floor(width / 4), y + Math.floor(height / 3), 1, 1);
        ctx.fillRect(x + Math.floor(width * 3 / 4) - 1, y + Math.floor(height / 3), 1, 1);
      }
    }
  }

  // Draw grid lines to help with editing
  function drawGrid() {
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)';
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (let i = 0; i <= 64; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 64);
      ctx.stroke();
    }

    // Horizontal lines
    for (let i = 0; i <= 64; i += 8) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(64, i);
      ctx.stroke();
    }
  }

  // Draw the background grid
  drawGrid();

  // ===== HEAD =====
  // According to the description: Head is 8x8 pixels at position [8-16, 8-16]
  const headMesh = parts.find(part => part.name === "hlava");

  // Helper function to draw texture from mesh
  function drawTextureFromMesh(mesh, x, y, width, height, faceIndex = 0) {
    if (!mesh || !mesh.userData.canvas) {
      // Fallback to base color if no texture
      const color = partColors[mesh.name];
      drawFace(x, y, width, height, color);
      return;
    }

    // Get the texture from the mesh
    const sourceCanvas = mesh.userData.canvas;
    const sourceCtx = sourceCanvas.getContext('2d');

    // Get a portion of the texture based on the face index
    // This is a simplified approach - in a real implementation, you'd map UV coordinates properly
    const faceWidth = sourceCanvas.width / 3;
    const faceHeight = sourceCanvas.height / 2;
    const sourceX = (faceIndex % 3) * faceWidth;
    const sourceY = Math.floor(faceIndex / 3) * faceHeight;

    // Get the image data for this face
    const imageData = sourceCtx.getImageData(sourceX, sourceY, faceWidth, faceHeight);

    // Create a temporary canvas to scale the face
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    // Create a temporary ImageData object
    const tempImageData = tempCtx.createImageData(width, height);

    // Simple scaling algorithm
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sourceX = Math.floor(x * faceWidth / width);
        const sourceY = Math.floor(y * faceHeight / height);

        const sourceIndex = (sourceY * faceWidth + sourceX) * 4;
        const targetIndex = (y * width + x) * 4;

        tempImageData.data[targetIndex] = imageData.data[sourceIndex];
        tempImageData.data[targetIndex + 1] = imageData.data[sourceIndex + 1];
        tempImageData.data[targetIndex + 2] = imageData.data[sourceIndex + 2];
        tempImageData.data[targetIndex + 3] = imageData.data[sourceIndex + 3];
      }
    }

    // Put the scaled image data on the temporary canvas
    tempCtx.putImageData(tempImageData, 0, 0);

    // Draw the temporary canvas onto the main canvas
    ctx.drawImage(tempCanvas, x, y);
  }

  // Head - front face (8x8 pixels)
  drawTextureFromMesh(headMesh, 8, 8, 8, 8, 0);

  // Head - top face
  drawTextureFromMesh(headMesh, 8, 0, 8, 8, 1);

  // Head - right side
  drawTextureFromMesh(headMesh, 0, 8, 8, 8, 2);

  // Head - bottom face
  drawTextureFromMesh(headMesh, 16, 0, 8, 8, 3);

  // Head - back face
  drawTextureFromMesh(headMesh, 24, 8, 8, 8, 4);

  // Head - left side
  drawTextureFromMesh(headMesh, 16, 8, 8, 8, 5);

  // ===== BODY =====
  // According to the description: Body is 8x12 pixels at position [20-28, 20-32]
  const bodyMesh = parts.find(part => part.name === "telo");

  // Body - front
  drawTextureFromMesh(bodyMesh, 20, 20, 8, 12, 0);

  // Body - back
  drawTextureFromMesh(bodyMesh, 32, 20, 8, 12, 1);

  // ===== ARMS =====
  // Left arm (4x12 pixels) at position [44-48, 20-32]
  const leftArmMesh = parts.find(part => part.name === "rukaL");

  // Left arm - front
  drawTextureFromMesh(leftArmMesh, 44, 20, 4, 12, 0);

  // Left arm - outer side
  drawTextureFromMesh(leftArmMesh, 48, 20, 4, 12, 1);

  // Left arm - back
  drawTextureFromMesh(leftArmMesh, 52, 20, 4, 12, 2);

  // Left arm - inner side
  drawTextureFromMesh(leftArmMesh, 40, 20, 4, 12, 3);

  // Left arm - top
  drawTextureFromMesh(leftArmMesh, 44, 16, 4, 4, 4);

  // Left arm - bottom
  drawTextureFromMesh(leftArmMesh, 48, 16, 4, 4, 5);

  // Right arm (4x12 pixels) at position [36-40, 52-64]
  const rightArmMesh = parts.find(part => part.name === "rukaP");

  // Right arm - front
  drawTextureFromMesh(rightArmMesh, 36, 52, 4, 12, 0);

  // Right arm - outer side
  drawTextureFromMesh(rightArmMesh, 32, 52, 4, 12, 1);

  // Right arm - back
  drawTextureFromMesh(rightArmMesh, 44, 52, 4, 12, 2);

  // Right arm - inner side
  drawTextureFromMesh(rightArmMesh, 40, 52, 4, 12, 3);

  // Right arm - top
  drawTextureFromMesh(rightArmMesh, 36, 48, 4, 4, 4);

  // Right arm - bottom
  drawTextureFromMesh(rightArmMesh, 40, 48, 4, 4, 5);

  // ===== LEGS =====
  // Left leg (4x12 pixels) at position [4-8, 20-32]
  const leftLegMesh = parts.find(part => part.name === "nohaL");

  // Left leg - front
  drawTextureFromMesh(leftLegMesh, 4, 20, 4, 12, 0);

  // Left leg - outer side
  drawTextureFromMesh(leftLegMesh, 8, 20, 4, 12, 1);

  // Left leg - back
  drawTextureFromMesh(leftLegMesh, 12, 20, 4, 12, 2);

  // Left leg - inner side
  drawTextureFromMesh(leftLegMesh, 0, 20, 4, 12, 3);

  // Left leg - top
  drawTextureFromMesh(leftLegMesh, 4, 16, 4, 4, 4);

  // Left leg - bottom
  drawTextureFromMesh(leftLegMesh, 8, 16, 4, 4, 5);

  // Right leg (4x12 pixels) at position [20-24, 52-64]
  const rightLegMesh = parts.find(part => part.name === "nohaP");

  // Right leg - front
  drawTextureFromMesh(rightLegMesh, 20, 52, 4, 12, 0);

  // Right leg - outer side
  drawTextureFromMesh(rightLegMesh, 16, 52, 4, 12, 1);

  // Right leg - back
  drawTextureFromMesh(rightLegMesh, 28, 52, 4, 12, 2);

  // Right leg - inner side
  drawTextureFromMesh(rightLegMesh, 24, 52, 4, 12, 3);

  // Right leg - top
  drawTextureFromMesh(rightLegMesh, 20, 48, 4, 4, 4);

  // Right leg - bottom
  drawTextureFromMesh(rightLegMesh, 24, 48, 4, 4, 5);

  // ===== OVERLAY LAYERS =====
  // These are the second layers that allow for details like armor, clothing, etc.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 0.5;

  // Head overlay (hat layer)
  ctx.strokeRect(40, 8, 8, 8); // Front
  ctx.strokeRect(48, 8, 8, 8); // Left
  ctx.strokeRect(56, 8, 8, 8); // Back
  ctx.strokeRect(32, 8, 8, 8); // Right
  ctx.strokeRect(40, 0, 8, 8); // Top
  ctx.strokeRect(48, 0, 8, 8); // Bottom

  // Body overlay (jacket layer)
  ctx.strokeRect(20, 36, 8, 12); // Front
  ctx.strokeRect(32, 36, 8, 12); // Back

  // Left arm overlay (sleeve layer)
  ctx.strokeRect(44, 36, 4, 12); // Front
  ctx.strokeRect(48, 36, 4, 12); // Outer
  ctx.strokeRect(52, 36, 4, 12); // Back
  ctx.strokeRect(40, 36, 4, 12); // Inner

  // Right arm overlay (sleeve layer)
  ctx.strokeRect(36, 36, 4, 12); // Front
  ctx.strokeRect(32, 36, 4, 12); // Outer
  ctx.strokeRect(28, 36, 4, 12); // Back
  ctx.strokeRect(24, 36, 4, 12); // Inner

  // Left leg overlay (pants layer)
  ctx.strokeRect(4, 36, 4, 12); // Front
  ctx.strokeRect(8, 36, 4, 12); // Outer
  ctx.strokeRect(12, 36, 4, 12); // Back
  ctx.strokeRect(0, 36, 4, 12); // Inner

  // Right leg overlay (pants layer)
  ctx.strokeRect(4, 52, 4, 12); // Front
  ctx.strokeRect(8, 52, 4, 12); // Outer
  ctx.strokeRect(12, 52, 4, 12); // Back
  ctx.strokeRect(0, 52, 4, 12); // Inner

  // Add labels to help identify parts
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.font = '4px Arial';
  ctx.fillText('HEAD', 9, 13);
  ctx.fillText('BODY', 21, 26);
  ctx.fillText('L ARM', 44, 26);
  ctx.fillText('R ARM', 36, 58);
  ctx.fillText('L LEG', 4, 26);
  ctx.fillText('R LEG', 20, 58);

  return canvas.toDataURL();
}

// Export template button event listener
exportTemplateBtn.addEventListener('click', () => {
  // Generate a new template if we don't have one or if it's outdated
  if (!lastTemplateDataURL) {
    lastTemplateDataURL = generateSkinTemplate();
  }

  const link = document.createElement('a');
  link.download = 'minecraft-skin-template.png';
  link.href = lastTemplateDataURL;
  link.click();
});

// Mode switching buttons
const colorModeBtn = document.getElementById('colorModeBtn');
const pixelModeBtn = document.getElementById('pixelModeBtn');
const brushSizeDisplay = document.getElementById('brushSizeDisplay');
const decreaseBrushBtn = document.getElementById('decreaseBrushBtn');
const increaseBrushBtn = document.getElementById('increaseBrushBtn');

// Initially hide brush controls
document.getElementById('brushSizeControls').style.display = 'none';

// Mode switching
colorModeBtn.addEventListener('click', () => {
  editingMode = 'color';
  colorModeBtn.classList.add('active');
  pixelModeBtn.classList.remove('active');
  document.getElementById('brushSizeControls').style.display = 'none';
});

pixelModeBtn.addEventListener('click', () => {
  editingMode = 'pixel';
  pixelModeBtn.classList.add('active');
  colorModeBtn.classList.remove('active');
  document.getElementById('brushSizeControls').style.display = 'flex';
});

// Brush size controls
decreaseBrushBtn.addEventListener('click', () => {
  if (currentBrushSize > 1) {
    currentBrushSize--;
    brushSizeDisplay.textContent = `${currentBrushSize}px`;
  }
});

increaseBrushBtn.addEventListener('click', () => {
  if (currentBrushSize < 10) {
    currentBrushSize++;
    brushSizeDisplay.textContent = `${currentBrushSize}px`;
  }
});

// Edit template button event listener (renamed from editPixelsBtn)
editPixelsBtn.addEventListener('click', () => {
  // Generate a new template if we don't have one or if it's outdated
  if (!lastTemplateDataURL) {
    lastTemplateDataURL = generateSkinTemplate();
  }

  // Open the pixel editor with the template
  pixelEditor.open(lastTemplateDataURL);
});

// Listen for save events from the pixel editor
document.addEventListener('pixelEditorSave', (event) => {
  // Update the template data URL
  lastTemplateDataURL = event.detail.dataURL;

  // Show a notification
  alert('Šablona byla úspěšně upravena! Klikněte na "Exportovat šablonu" pro stažení.');
});

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add keyboard shortcuts
window.addEventListener('keydown', (event) => {
  // Only handle shortcuts if the pixel editor is open
  if (document.getElementById('pixelEditorContainer').style.display !== 'flex') return;

  // Ctrl+Z for undo
  if (event.ctrlKey && event.key === 'z') {
    event.preventDefault();
    pixelEditor.undo();
  }

  // Ctrl+Y for redo
  if (event.ctrlKey && event.key === 'y') {
    event.preventDefault();
    pixelEditor.redo();
  }

  // Escape to close the editor
  if (event.key === 'Escape') {
    event.preventDefault();
    pixelEditor.close();
  }
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
