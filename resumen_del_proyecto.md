# Resumen del Proyecto SDR WebApp

Este archivo resume los pasos y comandos clave para configurar, desplegar y gestionar la aplicación de seguimiento de vuelos.

## 1. Estructura del Proyecto

El código de la aplicación se encuentra en la carpeta `sdr-webapp/`.

- `index.js`: El servidor backend (Node.js + Express).
- `public/`: Contiene el frontend (HTML, CSS, JS).
- `flights.db`: La base de datos SQLite que se crea automáticamente.
- `package.json`: Define las dependencias del proyecto.

## 2. Funcionalidades Implementadas

- **Vista en Vivo:** Muestra la última posición conocida de los aviones.
- **Historial:** Guarda todas las detecciones de vuelos para consulta futura.
- **Consulta de Historial:** La interfaz web permite buscar vuelos por fecha y/o número de vuelo.
- **Purga de Datos:** La interfaz permite borrar registros de la base de datos por rango de fechas para gestionar el almacenamiento.

## 3. Comandos para Subir a GitHub

1.  **Inicializar Repositorio:**
    ```bash
    git init
    git branch -m master main
    ```
2.  **Crear `.gitignore`:** Se creó un archivo `.gitignore` para ignorar `node_modules/` y `sdr-webapp/flights.db`.

3.  **Añadir y Confirmar:**
    ```bash
    git add .
    git commit -m "Initial commit"
    ```
4.  **Conectar y Subir:**
    ```bash
    git remote add origin https://github.com/horaciokar/sdr-webapp.git
    git push -u origin main
    ```

## 4. Configuración en Raspberry Pi / Orange Pi

### A. Actualización de Node.js (Solución al error `Unsupported engine`)

Se utilizó `nvm` (Node Version Manager) para instalar una versión moderna de Node.js.

1.  **Instalar nvm:**
    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    ```
2.  **Activar nvm y recargar terminal.**

3.  **Instalar Node.js LTS:**
    ```bash
    nvm install --lts
    ```

### B. Instalación de la App

1.  **Clonar:**
    ```bash
    git clone https://github.com/horaciokar/sdr-webapp.git
    ```
2.  **Instalar dependencias (puede tardar varios minutos):**
    ```bash
    cd sdr-webapp/sdr-webapp  # O la ruta correcta donde se clonó
    npm install
    ```
3.  **Probar manualmente:**
    ```bash
    npm start
    ```

### C. Configurar Inicio Automático (systemd)

1.  **Crear el archivo de servicio:**
    ```bash
    sudo nano /etc/systemd/system/sdr-webapp.service
    ```
2.  **Contenido del archivo** (ajustado para el usuario `root` y la ruta observada):
    ```ini
    [Unit]
    Description=SDR Flight Tracker WebApp
    After=network.target

    [Service]
    User=root
    Type=simple
    WorkingDirectory=/root/projects/sdr-webapp/sdr-webapp
    ExecStart=/usr/bin/npm start
    Restart=always
    RestartSec=10

    [Install]
    WantedBy=multi-user.target
    ```
3.  **Activar y gestionar el servicio:**
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable sdr-webapp.service
    sudo systemctl start sdr-webapp.service
    sudo systemctl status sdr-webapp.service
    ```
