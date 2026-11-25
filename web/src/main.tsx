import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Las letras van dentro de la app: no se pide nada a servidores de terceros.
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './estilos.css';
import { App } from './App.tsx';
import { leerTema, ponerTema, ProveedorSesion } from './base.tsx';

ponerTema(leerTema());
createRoot(document.getElementById('raiz')!).render(<StrictMode><ProveedorSesion><App /></ProveedorSesion></StrictMode>);
