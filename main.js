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
  const material = new THREE.MeshStandardMaterial({ color: savedColor || color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.name = name;
  scene.add(mesh);
  parts.push(mesh);

  // Store the color for template generation
  partColors[name] = savedColor ? new THREE.Color(savedColor) : new THREE.Color(color);
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

window.addEventListener('click', (event) => {
  // Ignore clicks if the pixel editor is open
  if (document.getElementById('pixelEditorContainer').style.display === 'flex') return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(parts);

  if (intersects.length > 0) {
    selectedMesh = intersects[0].object;
    const colorValue = colorPicker.value;
    selectedMesh.material.color.set(colorValue);
    localStorage.setItem(`part_${selectedMesh.name}`, colorValue);

    // Update the color in our partColors object
    partColors[selectedMesh.name] = new THREE.Color(colorValue);

    // Reset the last template since colors have changed
    lastTemplateDataURL = null;
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
  const headColor = partColors.hlava;

  // Head - front face (8x8 pixels)
  drawFace(8, 8, 8, 8, headColor, { type: 'eyes', color: '#000000' });

  // Head - top face
  drawFace(8, 0, 8, 8, headColor);

  // Head - right side
  drawFace(0, 8, 8, 8, headColor);

  // Head - bottom face
  drawFace(16, 0, 8, 8, headColor);

  // Head - back face
  drawFace(24, 8, 8, 8, headColor);

  // Head - left side
  drawFace(16, 8, 8, 8, headColor);

  // ===== BODY =====
  // According to the description: Body is 8x12 pixels at position [20-28, 20-32]
  const bodyColor = partColors.telo;

  // Body - front
  drawFace(20, 20, 8, 12, bodyColor);

  // Body - back
  drawFace(32, 20, 8, 12, bodyColor);

  // ===== ARMS =====
  // Left arm (4x12 pixels) at position [44-48, 20-32]
  const leftArmColor = partColors.rukaL;

  // Left arm - front
  drawFace(44, 20, 4, 12, leftArmColor);

  // Left arm - outer side
  drawFace(48, 20, 4, 12, leftArmColor);

  // Left arm - back
  drawFace(52, 20, 4, 12, leftArmColor);

  // Left arm - inner side
  drawFace(40, 20, 4, 12, leftArmColor);

  // Left arm - top
  drawFace(44, 16, 4, 4, leftArmColor);

  // Left arm - bottom
  drawFace(48, 16, 4, 4, leftArmColor);

  // Right arm (4x12 pixels) at position [36-40, 52-64]
  const rightArmColor = partColors.rukaP;

  // Right arm - front
  drawFace(36, 52, 4, 12, rightArmColor);

  // Right arm - outer side
  drawFace(32, 52, 4, 12, rightArmColor);

  // Right arm - back
  drawFace(44, 52, 4, 12, rightArmColor);

  // Right arm - inner side
  drawFace(40, 52, 4, 12, rightArmColor);

  // Right arm - top
  drawFace(36, 48, 4, 4, rightArmColor);

  // Right arm - bottom
  drawFace(40, 48, 4, 4, rightArmColor);

  // ===== LEGS =====
  // Left leg (4x12 pixels) at position [4-8, 20-32]
  const leftLegColor = partColors.nohaL;

  // Left leg - front
  drawFace(4, 20, 4, 12, leftLegColor);

  // Left leg - outer side
  drawFace(8, 20, 4, 12, leftLegColor);

  // Left leg - back
  drawFace(12, 20, 4, 12, leftLegColor);

  // Left leg - inner side
  drawFace(0, 20, 4, 12, leftLegColor);

  // Left leg - top
  drawFace(4, 16, 4, 4, leftLegColor);

  // Left leg - bottom
  drawFace(8, 16, 4, 4, leftLegColor);

  // Right leg (4x12 pixels) at position [20-24, 52-64]
  const rightLegColor = partColors.nohaP;

  // Right leg - front
  drawFace(20, 52, 4, 12, rightLegColor);

  // Right leg - outer side
  drawFace(16, 52, 4, 12, rightLegColor);

  // Right leg - back
  drawFace(28, 52, 4, 12, rightLegColor);

  // Right leg - inner side
  drawFace(24, 52, 4, 12, rightLegColor);

  // Right leg - top
  drawFace(20, 48, 4, 4, rightLegColor);

  // Right leg - bottom
  drawFace(24, 48, 4, 4, rightLegColor);

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

// Edit pixels button event listener
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
