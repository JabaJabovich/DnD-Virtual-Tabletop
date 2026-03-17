# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


## 🚀 How to Run Locally

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have the following installed on your machine:
* **[Node.js](https://nodejs.org/)** (v18 or higher recommended)
* **npm** (comes with Node.js), **yarn**, or **pnpm**
* **[Rust](https://www.rust-lang.org/tools/install)** (Only required if you want to build/run the standalone Desktop app via Tauri)

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/JabaJabovich/DnD-Virtual-Tabletop.git](https://github.com/JabaJabovich/DnD-Virtual-Tabletop.git)
   Navigate to the project folder:

cd DnD-Virtual-Tabletop
Install dependencies:

npm install
Running the App

Option A: Web Version (Browser)
To start the local development server for the browser, run:

npm run dev

The app will typically be available at http://localhost:5173.

Option B: Desktop Version (Tauri)
To run the project as a native desktop application, run:

npm run tauri dev
