# Minecraft Skin Creator

A simple 3D Minecraft skin creator built with Three.js that allows you to customize a character and export it as a standard Minecraft skin template.

## Features

- Interactive 3D model with selectable body parts
- Color customization for each body part
- Save current view as PNG
- Export as a standard 64x64 Minecraft skin template
- Persistent color settings using localStorage

## Getting Started

### Prerequisites

- Node.js (v14 or higher recommended)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/minecraft-skin-creator.git
cd minecraft-skin-creator
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Click on any part of the character to select it
2. Use the color picker to change the color of the selected part
3. Use the mouse to rotate the view (left click + drag)
4. Zoom in/out with the mouse wheel
5. Click "Uložit PNG" to save the current view as a PNG image
6. Click "Exportovat šablonu" to generate and download a standard 64x64 Minecraft skin template

## Minecraft Skin Template Structure

The exported template follows the standard Minecraft skin layout (64x64 pixels):

- **Head (8x8 pixels)**: Located at position [8-16, 8-16]
- **Body (8x12 pixels)**: Located at position [20-28, 20-32]
- **Arms (4x12 pixels each)**:
  - Left arm: position [44-48, 20-32]
  - Right arm: position [36-40, 52-64]
- **Legs (4x12 pixels each)**:
  - Left leg: position [4-8, 20-32]
  - Right leg: position [20-24, 52-64]
- **Overlay layers**: Second layer for each body part for details like armor, clothing, etc.

## Building for Production

To build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory and can be deployed to any static hosting service.

## Technologies Used

- [Three.js](https://threejs.org/) - 3D graphics library
- [Vite](https://vitejs.dev/) - Next generation frontend tooling

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Minecraft is a trademark of Mojang Studios
- This project is for educational purposes only
