// Pixel Editor Module
export class PixelEditor {
  constructor() {
    this.canvas = document.getElementById('pixelEditorCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.container = document.getElementById('pixelEditorContainer');
    this.colorPicker = document.getElementById('editorColorPicker');
    this.saveBtn = document.getElementById('savePixelEditorBtn');
    this.closeBtn = document.getElementById('closeEditorBtn');
    this.zoomInBtn = document.getElementById('zoomInBtn');
    this.zoomOutBtn = document.getElementById('zoomOutBtn');
    this.resetZoomBtn = document.getElementById('resetZoomBtn');
    this.coordsDisplay = document.getElementById('pixelCoordinates');
    this.toolButtons = document.querySelectorAll('.tool');

    this.pixelSize = 10; // Initial pixel size (zoom level)
    this.originalPixelSize = 10;
    this.gridSize = 64; // 64x64 Minecraft skin
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.currentTool = 'pencil';
    this.imageData = null;
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSteps = 20;

    this.init();
  }

  init() {
    // Initialize the canvas with a blank 64x64 grid
    this.resetCanvas();

    // Event listeners
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mousemove', this.updateCoordinates.bind(this));

    this.saveBtn.addEventListener('click', this.saveChanges.bind(this));
    this.closeBtn.addEventListener('click', this.close.bind(this));

    this.zoomInBtn.addEventListener('click', () => this.zoom(1.5));
    this.zoomOutBtn.addEventListener('click', () => this.zoom(0.75));
    this.resetZoomBtn.addEventListener('click', () => this.resetZoom());

    // Tool selection
    this.toolButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.toolButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        this.currentTool = button.dataset.tool;
      });
    });
  }

  resetCanvas() {
    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw the grid
    this.drawGrid();

    // Save the initial state for undo
    this.saveState();
  }

  drawGrid() {
    const { ctx, canvas, pixelSize, gridSize } = this;

    // Draw background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;

    for (let i = 0; i <= gridSize; i++) {
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(i * pixelSize, 0);
      ctx.lineTo(i * pixelSize, gridSize * pixelSize);
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, i * pixelSize);
      ctx.lineTo(gridSize * pixelSize, i * pixelSize);
      ctx.stroke();
    }

    // Draw section dividers (every 8 pixels) with darker lines
    ctx.strokeStyle = '#a0a0a0';
    ctx.lineWidth = 1;

    for (let i = 0; i <= gridSize; i += 8) {
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(i * pixelSize, 0);
      ctx.lineTo(i * pixelSize, gridSize * pixelSize);
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, i * pixelSize);
      ctx.lineTo(gridSize * pixelSize, i * pixelSize);
      ctx.stroke();
    }
  }

  loadImageData(dataURL) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Create a temporary canvas to draw the image at its original size
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 64;
        tempCanvas.height = 64;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw the image on the temporary canvas
        tempCtx.drawImage(img, 0, 0);

        // Get the pixel data
        const imageData = tempCtx.getImageData(0, 0, 64, 64);

        // Clear our main canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw the grid
        this.drawGrid();

        // Draw each pixel from the image data
        for (let y = 0; y < 64; y++) {
          for (let x = 0; x < 64; x++) {
            const index = (y * 64 + x) * 4;
            const r = imageData.data[index];
            const g = imageData.data[index + 1];
            const b = imageData.data[index + 2];
            const a = imageData.data[index + 3];

            if (a > 0) { // Only draw non-transparent pixels
              this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
              this.ctx.fillRect(
                x * this.pixelSize,
                y * this.pixelSize,
                this.pixelSize,
                this.pixelSize
              );
            }
          }
        }

        // Save the initial state for undo
        this.saveState();
        resolve();
      };
      img.src = dataURL;
    });
  }

  open(dataURL) {
    // Show the editor
    this.container.style.display = 'flex';

    // Load the image data if provided
    if (dataURL) {
      this.loadImageData(dataURL);
    } else {
      this.resetCanvas();
    }
  }

  close() {
    this.container.style.display = 'none';
  }

  saveChanges() {
    // Create a temporary canvas to get the 64x64 image data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 64;
    tempCanvas.height = 64;
    const tempCtx = tempCanvas.getContext('2d');

    // Get the pixel data from our editor canvas
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const pixelData = this.ctx.getImageData(
          x * this.pixelSize + 1,
          y * this.pixelSize + 1,
          1, 1
        ).data;

        if (pixelData[3] > 0) { // If not fully transparent
          tempCtx.fillStyle = `rgba(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]}, ${pixelData[3] / 255})`;
          tempCtx.fillRect(x, y, 1, 1);
        }
      }
    }

    // Return the data URL of the 64x64 image
    const dataURL = tempCanvas.toDataURL();

    // Create a custom event with the data URL
    const event = new CustomEvent('pixelEditorSave', { detail: { dataURL } });
    document.dispatchEvent(event);

    // Close the editor
    this.close();
  }

  updateCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / this.pixelSize);
    const y = Math.floor((e.clientY - rect.top) / this.pixelSize);

    if (x >= 0 && x < 64 && y >= 0 && y < 64) {
      this.coordsDisplay.textContent = `Pozice: ${x}, ${y}`;
    }
  }

  handleMouseDown(e) {
    this.isDrawing = true;
    const rect = this.canvas.getBoundingClientRect();
    this.lastX = Math.floor((e.clientX - rect.left) / this.pixelSize);
    this.lastY = Math.floor((e.clientY - rect.top) / this.pixelSize);

    // Save the current state before making changes
    this.saveState();

    // Handle different tools
    if (this.currentTool === 'pencil') {
      this.drawPixel(this.lastX, this.lastY);
    } else if (this.currentTool === 'eraser') {
      this.erasePixel(this.lastX, this.lastY);
    } else if (this.currentTool === 'eyedropper') {
      this.pickColor(this.lastX, this.lastY);
    } else if (this.currentTool === 'fill') {
      this.fillArea(this.lastX, this.lastY);
    }
  }

  handleMouseMove(e) {
    if (!this.isDrawing) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / this.pixelSize);
    const y = Math.floor((e.clientY - rect.top) / this.pixelSize);

    if (x === this.lastX && y === this.lastY) return;

    if (this.currentTool === 'pencil') {
      // Draw a line from last position to current position
      this.drawLine(this.lastX, this.lastY, x, y);
    } else if (this.currentTool === 'eraser') {
      this.erasePixel(x, y);
    }

    this.lastX = x;
    this.lastY = y;
  }

  handleMouseUp() {
    this.isDrawing = false;
  }

  drawPixel(x, y) {
    if (x < 0 || x >= 64 || y < 0 || y >= 64) return;

    this.ctx.fillStyle = this.colorPicker.value;
    this.ctx.fillRect(
      x * this.pixelSize,
      y * this.pixelSize,
      this.pixelSize,
      this.pixelSize
    );
  }

  erasePixel(x, y) {
    if (x < 0 || x >= 64 || y < 0 || y >= 64) return;

    // Clear the pixel
    this.ctx.clearRect(
      x * this.pixelSize,
      y * this.pixelSize,
      this.pixelSize,
      this.pixelSize
    );

    // Redraw the grid lines for this pixel
    this.ctx.strokeStyle = '#e0e0e0';
    this.ctx.lineWidth = 0.5;

    // Draw the grid lines for this pixel
    this.ctx.beginPath();
    this.ctx.moveTo(x * this.pixelSize, y * this.pixelSize);
    this.ctx.lineTo((x + 1) * this.pixelSize, y * this.pixelSize);
    this.ctx.lineTo((x + 1) * this.pixelSize, (y + 1) * this.pixelSize);
    this.ctx.lineTo(x * this.pixelSize, (y + 1) * this.pixelSize);
    this.ctx.closePath();
    this.ctx.stroke();

    // Check if this is on a section divider (every 8 pixels)
    if (x % 8 === 0 || y % 8 === 0) {
      this.ctx.strokeStyle = '#a0a0a0';
      this.ctx.lineWidth = 1;

      if (x % 8 === 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(x * this.pixelSize, y * this.pixelSize);
        this.ctx.lineTo(x * this.pixelSize, (y + 1) * this.pixelSize);
        this.ctx.stroke();
      }

      if (y % 8 === 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(x * this.pixelSize, y * this.pixelSize);
        this.ctx.lineTo((x + 1) * this.pixelSize, y * this.pixelSize);
        this.ctx.stroke();
      }
    }
  }

  pickColor(x, y) {
    if (x < 0 || x >= 64 || y < 0 || y >= 64) return;

    // Get the color of the pixel
    const pixelData = this.ctx.getImageData(
      x * this.pixelSize + 1,
      y * this.pixelSize + 1,
      1, 1
    ).data;

    // If the pixel is not transparent
    if (pixelData[3] > 0) {
      // Convert RGB to hex
      const hex = '#' +
        ('0' + pixelData[0].toString(16)).slice(-2) +
        ('0' + pixelData[1].toString(16)).slice(-2) +
        ('0' + pixelData[2].toString(16)).slice(-2);

      // Set the color picker value
      this.colorPicker.value = hex;
    }

    // Switch back to pencil tool
    this.toolButtons.forEach(btn => {
      if (btn.dataset.tool === 'pencil') {
        btn.click();
      }
    });
  }

  fillArea(x, y) {
    if (x < 0 || x >= 64 || y < 0 || y >= 64) return;

    // Get the color of the target pixel
    const targetPixelData = this.ctx.getImageData(
      x * this.pixelSize + 1,
      y * this.pixelSize + 1,
      1, 1
    ).data;

    // Convert target color to string for comparison
    const targetColor = `${targetPixelData[0]},${targetPixelData[1]},${targetPixelData[2]},${targetPixelData[3]}`;

    // Get the fill color
    const fillColorHex = this.colorPicker.value;
    const r = parseInt(fillColorHex.slice(1, 3), 16);
    const g = parseInt(fillColorHex.slice(3, 5), 16);
    const b = parseInt(fillColorHex.slice(5, 7), 16);
    const fillColor = `${r},${g},${b},255`;

    // If the target color is the same as the fill color, do nothing
    if (targetColor === fillColor) return;

    // Flood fill algorithm
    const stack = [[x, y]];
    const visited = new Set();

    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      const key = `${cx},${cy}`;

      if (visited.has(key)) continue;
      visited.add(key);

      // Get the color of the current pixel
      const pixelData = this.ctx.getImageData(
        cx * this.pixelSize + 1,
        cy * this.pixelSize + 1,
        1, 1
      ).data;

      const currentColor = `${pixelData[0]},${pixelData[1]},${pixelData[2]},${pixelData[3]}`;

      // If the current pixel color matches the target color, fill it and check neighbors
      if (currentColor === targetColor) {
        this.drawPixel(cx, cy);

        // Check the four adjacent pixels
        if (cx > 0) stack.push([cx - 1, cy]);
        if (cx < 63) stack.push([cx + 1, cy]);
        if (cy > 0) stack.push([cx, cy - 1]);
        if (cy < 63) stack.push([cx, cy + 1]);
      }
    }
  }

  drawLine(x0, y0, x1, y1) {
    // Bresenham's line algorithm
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.drawPixel(x0, y0);

      if (x0 === x1 && y0 === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  zoom(factor) {
    // Calculate new pixel size
    const newPixelSize = Math.max(2, Math.min(20, this.pixelSize * factor));

    if (newPixelSize !== this.pixelSize) {
      // Save the current state
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

      // Update pixel size
      this.pixelSize = newPixelSize;

      // Clear canvas and redraw grid
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.drawGrid();

      // Redraw the image at the new scale
      this.ctx.putImageData(imageData, 0, 0);
    }
  }

  resetZoom() {
    // Reset to original pixel size
    this.pixelSize = this.originalPixelSize;

    // Save the current state
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    // Clear canvas and redraw grid
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();

    // Redraw the image at the original scale
    this.ctx.putImageData(imageData, 0, 0);
  }

  saveState() {
    // Save the current canvas state to the undo stack
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.undoStack.push(imageData);

    // Limit the undo stack size
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }

    // Clear the redo stack when a new action is performed
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length > 1) {
      // Save current state to redo stack
      const currentState = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.redoStack.push(currentState);

      // Remove the current state from the undo stack
      this.undoStack.pop();

      // Get the previous state
      const previousState = this.undoStack[this.undoStack.length - 1];

      // Restore the previous state
      this.ctx.putImageData(previousState, 0, 0);
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      // Get the next state from the redo stack
      const nextState = this.redoStack.pop();

      // Save current state to undo stack
      const currentState = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      this.undoStack.push(currentState);

      // Restore the next state
      this.ctx.putImageData(nextState, 0, 0);
    }
  }
}
