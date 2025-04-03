import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PixelEditor } from './pixelEditor.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe0e0e0); // Světle šedé pozadí pro lepší viditelnost postavy
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1); // Zajistí pixelově přesné vykreslování
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enabled = true; // Explicitly enable controls by default (color mode)

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

  // Determine grid size based on part type
  let gridWidth, gridHeight;
  switch (name) {
    case "hlava":
      gridWidth = 8;
      gridHeight = 8;
      break;
    case "telo":
      gridWidth = 8;
      gridHeight = 12;
      break;
    case "rukaL":
    case "rukaP":
    case "nohaL":
    case "nohaP":
      gridWidth = 4;
      gridHeight = 12;
      break;
    default:
      gridWidth = 8;
      gridHeight = 8;
  }

  // Calculate cell size
  const cellWidth = textureSize / gridWidth;
  const cellHeight = textureSize / gridHeight;

  // Fill with the base color
  ctx.fillStyle = savedColor || `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, textureSize, textureSize);

  // Draw grid lines to help with pixel editing
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 1;

  // Draw vertical grid lines
  for (let i = 1; i < gridWidth; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellWidth, 0);
    ctx.lineTo(i * cellWidth, textureSize);
    ctx.stroke();
  }

  // Draw horizontal grid lines
  for (let i = 1; i < gridHeight; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * cellHeight);
    ctx.lineTo(textureSize, i * cellHeight);
    ctx.stroke();
  }

  // Create texture from canvas with pixel-perfect settings
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false; // Vypnout mipmapping pro ostřejší pixely
  texture.needsUpdate = true;

  // Create material with the texture
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff, // White color to not affect the texture
    flatShading: true // Zajistí ostré hrany
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.name = name;

  // Store the canvas and context for later pixel editing
  mesh.userData = {
    canvas: canvas,
    context: ctx,
    texture: texture,
    baseColor: savedColor ? new THREE.Color(savedColor) : new THREE.Color(color),
    gridWidth: gridWidth,
    gridHeight: gridHeight
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
// Přední světlo
const frontLight = new THREE.DirectionalLight(0xffffff, 1);
frontLight.position.set(5, 5, 5).normalize();
scene.add(frontLight);

// Zadní světlo pro lepší viditelnost zezadu
const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
backLight.position.set(-5, 5, -5).normalize();
scene.add(backLight);

// Boční světla pro lepší viditelnost ze stran
const leftLight = new THREE.DirectionalLight(0xffffff, 0.5);
leftLight.position.set(-5, 0, 0).normalize();
scene.add(leftLight);

const rightLight = new THREE.DirectionalLight(0xffffff, 0.5);
rightLight.position.set(5, 0, 0).normalize();
scene.add(rightLight);

// Add ambient light to better see the model
const ambientLight = new THREE.AmbientLight(0x404040, 0.7);
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

  // Get grid size based on the part type
  let gridWidth, gridHeight;

  switch (mesh.name) {
    case "hlava":
      gridWidth = 8;
      gridHeight = 8;
      break;
    case "telo":
      gridWidth = 8;
      gridHeight = 12;
      break;
    case "rukaL":
    case "rukaP":
    case "nohaL":
    case "nohaP":
      gridWidth = 4;
      gridHeight = 12;
      break;
    default:
      gridWidth = 8;
      gridHeight = 8;
  }

  // Calculate the size of each grid cell in the texture
  const cellWidth = canvas.width / gridWidth;
  const cellHeight = canvas.height / gridHeight;

  // Determine which face of the cube was clicked using the face normal
  let faceIndex = -1;
  if (intersect.face) {
    // Get the normal vector of the face
    const normal = intersect.face.normal.clone();
    // Transform the normal to world space
    normal.transformDirection(mesh.matrixWorld);

    // Determine which face was clicked based on the normal direction
    // The normals point outward from the cube faces
    if (Math.abs(normal.x) > Math.abs(normal.y) && Math.abs(normal.x) > Math.abs(normal.z)) {
      // X-axis face (left or right)
      faceIndex = normal.x > 0 ? 0 : 1; // 0 = right face, 1 = left face
    } else if (Math.abs(normal.y) > Math.abs(normal.x) && Math.abs(normal.y) > Math.abs(normal.z)) {
      // Y-axis face (top or bottom)
      faceIndex = normal.y > 0 ? 2 : 3; // 2 = top face, 3 = bottom face
    } else {
      // Z-axis face (front or back)
      faceIndex = normal.z > 0 ? 4 : 5; // 4 = front face, 5 = back face
    }
  }

  // Convert UV coordinates to grid coordinates
  const gridX = Math.floor(uv.x * gridWidth);
  const gridY = Math.floor((1 - uv.y) * gridHeight);

  // Calculate the pixel position in the texture
  const pixelX = gridX * cellWidth;
  const pixelY = gridY * cellHeight;

  // Set the fill style to the selected color
  ctx.fillStyle = color;

  // Use crisp edges for pixel-perfect rendering
  ctx.imageSmoothingEnabled = false;

  // For all mesh parts, we'll use face-specific painting
  if (faceIndex >= 0) {
    // Define texture coordinates for the specific face
    let textureX = pixelX;
    let textureY = pixelY;

    // Store the original pixel data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Draw the pixel at the calculated position
    ctx.fillRect(
      Math.floor(textureX),
      Math.floor(textureY),
      Math.floor(cellWidth),
      Math.floor(cellHeight)
    );

    // For limbs (arms and legs), we need special handling to paint only on specific faces
    if (mesh.name === "rukaL" || mesh.name === "rukaP" || mesh.name === "nohaL" || mesh.name === "nohaP") {
      // Create a unique identifier for this face based on the face index and grid position
      // This will help us track which pixels belong to which face
      if (!mesh.userData.facePixels) {
        mesh.userData.facePixels = {};
      }

      // Create a key for this specific grid cell
      const cellKey = `${gridX},${gridY}`;

      // If this cell wasn't previously painted on any face, initialize it
      if (!mesh.userData.facePixels[cellKey]) {
        mesh.userData.facePixels[cellKey] = {};
      }

      // Store which face this cell was painted on
      mesh.userData.facePixels[cellKey][faceIndex] = true;

      // Now, we'll only keep the pixels that were painted on the current face
      // and restore the original pixels for all other faces

      // Get the updated pixel data
      const updatedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Restore the original image
      ctx.putImageData(imageData, 0, 0);

      // For each grid cell that has been painted
      for (const cellKeyIter in mesh.userData.facePixels) {
        // Parse the grid coordinates
        const [cellGridX, cellGridY] = cellKeyIter.split(',').map(Number);

        // Calculate the pixel position for this cell
        const cellPixelX = cellGridX * cellWidth;
        const cellPixelY = cellGridY * cellHeight;

        // For each face that this cell has been painted on
        for (const facePainted in mesh.userData.facePixels[cellKeyIter]) {
          // Only draw if this is the face we're currently painting on
          if (parseInt(facePainted) === faceIndex) {
            // Apply the current color to this cell
            ctx.fillStyle = color;
            ctx.fillRect(
              Math.floor(cellPixelX),
              Math.floor(cellPixelY),
              Math.floor(cellWidth),
              Math.floor(cellHeight)
            );
          }
        }
      }
    } else {
      // For head and body, we'll still paint only on the specific face
      // but we don't need to track individual faces as precisely
      ctx.fillRect(
        Math.floor(pixelX),
        Math.floor(pixelY),
        Math.floor(cellWidth),
        Math.floor(cellHeight)
      );
    }
  } else {
    // If no face was detected (shouldn't happen), fall back to original behavior
    ctx.fillRect(
      Math.floor(pixelX),
      Math.floor(pixelY),
      Math.floor(cellWidth),
      Math.floor(cellHeight)
    );
  }

  // Update the texture with pixel-perfect rendering
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false; // Vypnout mipmapping pro ostřejší pixely
  texture.needsUpdate = true;

  // Reset the template since we've made changes
  lastTemplateDataURL = null;

  // For debugging - show which grid cell was painted
  console.log(`Painted grid cell [${gridX}, ${gridY}] on ${mesh.name}, face: ${faceIndex}`);
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
  // Ensure controls remain disabled in pixel mode even after painting
  if (editingMode === 'pixel') {
    controls.enabled = false;
  }
});

// Multi-touch handling for rotation in pixel mode
let touchStartPositions = [];
let isMultiTouch = false;

window.addEventListener('touchstart', (event) => {
  // Store touch positions
  touchStartPositions = [];
  for (let i = 0; i < event.touches.length; i++) {
    touchStartPositions.push({
      x: event.touches[i].clientX,
      y: event.touches[i].clientY
    });
  }

  // If we have 2 or more touches and we're in pixel mode, enable multi-touch rotation
  isMultiTouch = event.touches.length >= 2 && editingMode === 'pixel';

  // If it's a single touch in pixel mode, handle it as a paint operation
  if (event.touches.length === 1 && editingMode === 'pixel' && !isMultiTouch) {
    const touch = event.touches[0];

    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(parts);

    if (intersects.length > 0) {
      isPainting = true;
      selectedMesh = intersects[0].object;
      paintPixelOnModel(selectedMesh, intersects[0], colorPicker.value);
    }

    // Prevent default to avoid scrolling while painting
    event.preventDefault();
  }
});

window.addEventListener('touchmove', (event) => {
  // If we're in multi-touch mode, handle rotation
  if (isMultiTouch && event.touches.length >= 2) {
    // Calculate the difference between the current and previous touch positions
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];

    const currentMidpoint = {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };

    const previousMidpoint = {
      x: (touchStartPositions[0].x + touchStartPositions[1].x) / 2,
      y: (touchStartPositions[0].y + touchStartPositions[1].y) / 2
    };

    // Calculate rotation based on the movement of the midpoint
    const rotationX = (currentMidpoint.x - previousMidpoint.x) * 0.01;
    const rotationY = (currentMidpoint.y - previousMidpoint.y) * 0.01;

    // Apply rotation to the camera
    camera.position.x = Math.cos(rotationX) * camera.position.x - Math.sin(rotationX) * camera.position.z;
    camera.position.z = Math.sin(rotationX) * camera.position.x + Math.cos(rotationX) * camera.position.z;
    camera.position.y += rotationY;
    camera.lookAt(scene.position);

    // Update touch positions for the next move event
    touchStartPositions = [];
    for (let i = 0; i < event.touches.length; i++) {
      touchStartPositions.push({
        x: event.touches[i].clientX,
        y: event.touches[i].clientY
      });
    }

    // Prevent default to avoid scrolling while rotating
    event.preventDefault();
  }
  // If we're painting with a single touch
  else if (isPainting && editingMode === 'pixel' && event.touches.length === 1) {
    const touch = event.touches[0];

    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([selectedMesh]);

    if (intersects.length > 0) {
      paintPixelOnModel(selectedMesh, intersects[0], colorPicker.value);
    }

    // Prevent default to avoid scrolling while painting
    event.preventDefault();
  }
});

window.addEventListener('touchend', (event) => {
  // Reset painting and multi-touch flags
  isPainting = false;
  isMultiTouch = false;

  // Ensure controls remain disabled in pixel mode
  if (editingMode === 'pixel') {
    controls.enabled = false;
  }
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

      // Get grid dimensions from userData
      const gridWidth = selectedMesh.userData.gridWidth || 8;
      const gridHeight = selectedMesh.userData.gridHeight || 8;
      const cellWidth = canvas.width / gridWidth;
      const cellHeight = canvas.height / gridHeight;

      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fill with the new color
      ctx.fillStyle = colorValue;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Redraw the grid lines
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 1;

      // Draw vertical grid lines
      for (let i = 1; i < gridWidth; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellWidth, 0);
        ctx.lineTo(i * cellWidth, canvas.height);
        ctx.stroke();
      }

      // Draw horizontal grid lines
      for (let i = 1; i < gridHeight; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellHeight);
        ctx.lineTo(canvas.width, i * cellHeight);
        ctx.stroke();
      }

      // Use pixel-perfect rendering
      ctx.imageSmoothingEnabled = false;
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.generateMipmaps = false; // Vypnout mipmapping pro ostřejší pixely
      texture.needsUpdate = true;

      // Reset any face-specific pixel data when changing the entire part color
      if (selectedMesh.userData.facePixels) {
        // Clear the face pixels data to start fresh
        selectedMesh.userData.facePixels = {};
      }

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

  // Disable image smoothing for pixel-perfect rendering
  ctx.imageSmoothingEnabled = false;

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

    // Get grid dimensions from userData
    const gridWidth = mesh.userData.gridWidth || 8;
    const gridHeight = mesh.userData.gridHeight || 8;

    // Calculate the size of each grid cell in the source texture
    const cellWidth = sourceCanvas.width / gridWidth;
    const cellHeight = sourceCanvas.height / gridHeight;

    // Create a temporary canvas for the face
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');

    // Disable image smoothing for pixel-perfect rendering
    tempCtx.imageSmoothingEnabled = false;

    // Map the face index to the appropriate grid cells
    // This is a simplified mapping - in a real implementation, you'd use proper UV mapping
    let startGridX = 0;
    let startGridY = 0;
    let faceGridWidth = width;
    let faceGridHeight = height;

    // For simplicity, we'll just use different parts of the texture for different faces
    // In a real implementation, you'd map the 3D model's UV coordinates properly
    switch (faceIndex) {
      case 0: // Front face
        startGridX = 0;
        startGridY = 0;
        break;
      case 1: // Top face
        startGridX = 0;
        startGridY = Math.floor(gridHeight / 3);
        break;
      case 2: // Right side
        startGridX = Math.floor(gridWidth / 3);
        startGridY = 0;
        break;
      case 3: // Bottom face
        startGridX = 0;
        startGridY = Math.floor(gridHeight * 2 / 3);
        break;
      case 4: // Back face
        startGridX = Math.floor(gridWidth * 2 / 3);
        startGridY = 0;
        break;
      case 5: // Left side
        startGridX = Math.floor(gridWidth / 3);
        startGridY = Math.floor(gridHeight / 3);
        break;
    }

    // Draw each grid cell to the appropriate position in the output
    for (let gridY = 0; gridY < faceGridHeight; gridY++) {
      for (let gridX = 0; gridX < faceGridWidth; gridX++) {
        // Get the color from the source grid cell
        const sourceX = (startGridX + gridX) % gridWidth;
        const sourceY = (startGridY + gridY) % gridHeight;

        const pixelX = sourceX * cellWidth;
        const pixelY = sourceY * cellHeight;

        // Get the color at this grid cell
        const imageData = sourceCtx.getImageData(
          pixelX + cellWidth / 2,
          pixelY + cellHeight / 2,
          1, 1
        );

        // Set the color in the output
        tempCtx.fillStyle = `rgba(${imageData.data[0]}, ${imageData.data[1]}, ${imageData.data[2]}, ${imageData.data[3] / 255})`;
        tempCtx.fillRect(gridX, gridY, 1, 1);
      }
    }

    // Draw the temporary canvas onto the main canvas
    ctx.drawImage(tempCanvas, x, y, width, height);
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

// Get rotation control buttons
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const rotateUpBtn = document.getElementById('rotateUpBtn');
const rotateDownBtn = document.getElementById('rotateDownBtn');

// Mode switching
colorModeBtn.addEventListener('click', () => {
  editingMode = 'color';
  colorModeBtn.classList.add('active');
  pixelModeBtn.classList.remove('active');
  document.getElementById('brushSizeControls').style.display = 'none';
  document.getElementById('rotationControls').style.display = 'none';

  // Enable orbit controls in color mode
  controls.enabled = true;
});

pixelModeBtn.addEventListener('click', () => {
  editingMode = 'pixel';
  pixelModeBtn.classList.add('active');
  colorModeBtn.classList.remove('active');
  document.getElementById('brushSizeControls').style.display = 'flex';
  document.getElementById('rotationControls').style.display = 'flex';

  // Disable orbit controls in pixel mode to prevent model movement during painting
  // We'll handle rotation manually with buttons and multi-touch
  controls.enabled = false;
});

// Initially hide rotation controls (we start in color mode)
document.getElementById('rotationControls').style.display = 'none';

// Rotation speed (in radians)
const ROTATION_SPEED = 0.1;

// Rotation control buttons
rotateLeftBtn.addEventListener('click', () => {
  camera.position.x = Math.cos(camera.position.z * ROTATION_SPEED) * camera.position.x -
    Math.sin(camera.position.z * ROTATION_SPEED) * camera.position.z;
  camera.position.z = Math.sin(camera.position.z * ROTATION_SPEED) * camera.position.x +
    Math.cos(camera.position.z * ROTATION_SPEED) * camera.position.z;
  camera.lookAt(scene.position);
});

rotateRightBtn.addEventListener('click', () => {
  camera.position.x = Math.cos(-camera.position.z * ROTATION_SPEED) * camera.position.x -
    Math.sin(-camera.position.z * ROTATION_SPEED) * camera.position.z;
  camera.position.z = Math.sin(-camera.position.z * ROTATION_SPEED) * camera.position.x +
    Math.cos(-camera.position.z * ROTATION_SPEED) * camera.position.z;
  camera.lookAt(scene.position);
});

rotateUpBtn.addEventListener('click', () => {
  camera.position.y += ROTATION_SPEED * 5;
  camera.lookAt(scene.position);
});

rotateDownBtn.addEventListener('click', () => {
  camera.position.y -= ROTATION_SPEED * 5;
  camera.lookAt(scene.position);
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
