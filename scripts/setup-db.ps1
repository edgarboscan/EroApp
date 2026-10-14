# ========================================================
# Script de Inicialización y Conexión de Base de Datos MySQL
# ========================================================

param(
    [string]$RootPassword = ""
)

$mysqlPath = "C:\Program Files\MySQL\MySQL Server 9.7\bin\mysql.exe"
if (-not (Test-Path $mysqlPath)) {
    $mysqlCmd = Get-Command mysql.exe -ErrorAction SilentlyContinue
    if ($mysqlCmd) {
        $mysqlPath = $mysqlCmd.Source
    } else {
        Write-Host "No se encontro mysql.exe en la ruta predeterminada ni en PATH." -ForegroundColor Red
        Write-Host "Verifique la instalacion de MySQL Server."
        exit 1
    }
}

Write-Host "=== CONFIGURACION DE BASE DE DATOS LOCAL (MySQL 9 / 8) ===" -ForegroundColor Cyan
Write-Host "Detectado MySQL en: $mysqlPath" -ForegroundColor Gray

if ([string]::IsNullOrWhiteSpace($RootPassword)) {
    $RootPassword = Read-Host -Prompt "Por favor, introduce la contrasena del usuario 'root' de MySQL"
}

Write-Host "`n1. Creando base de datos 'ero_erp_db' y usuario 'erp_admin'..." -ForegroundColor Cyan

$createUserSql = @"
CREATE DATABASE IF NOT EXISTS \`ero_erp_db\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'erp_admin'@'localhost' IDENTIFIED BY 'SecurePassword_2026!';
CREATE USER IF NOT EXISTS 'erp_admin'@'127.0.0.1' IDENTIFIED BY 'SecurePassword_2026!';
ALTER USER 'erp_admin'@'localhost' IDENTIFIED BY 'SecurePassword_2026!';
ALTER USER 'erp_admin'@'127.0.0.1' IDENTIFIED BY 'SecurePassword_2026!';
GRANT ALL PRIVILEGES ON \`ero_erp_db\`.* TO 'erp_admin'@'localhost' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON \`ero_erp_db\`.* TO 'erp_admin'@'127.0.0.1' WITH GRANT OPTION;
FLUSH PRIVILEGES;
"@

$proc = Start-Process -FilePath $mysqlPath -ArgumentList "-u", "root", "-p$RootPassword", "-e", "`"$createUserSql`"" -NoNewWindow -PassThru -Wait
if ($proc.ExitCode -ne 0) {
    Write-Host "`n[ERROR] No se pudo autenticar con 'root'. Compruebe que la contrasena de root sea la correcta." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Base de datos 'ero_erp_db' y usuario 'erp_admin' configurados con exito.`n" -ForegroundColor Green

Write-Host "2. Importando estructura y datos iniciales (DDL)..." -ForegroundColor Cyan
$ddlFiles = @(
    "apps\api\src\db\ddl\01_schema.sql",
    "apps\api\src\db\ddl\02_triggers.sql",
    "apps\api\src\db\ddl\03_procedures.sql",
    "apps\api\src\db\ddl\04_views.sql",
    "apps\api\src\db\ddl\05_seeds.sql"
)

foreach ($file in $ddlFiles) {
    if (Test-Path $file) {
        Write-Host "  -> Importando $file..." -ForegroundColor Yellow
        Get-Content $file -Raw | & $mysqlPath -u erp_admin -pSecurePassword_2026! ero_erp_db
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  -> Reintentando con root..." -ForegroundColor Gray
            Get-Content $file -Raw | & $mysqlPath -u root "-p$RootPassword" ero_erp_db
        }
    } else {
        Write-Host "  [!] Archivo no encontrado: $file" -ForegroundColor Red
    }
}

Write-Host "`n>>> BASE DE DATOS INICIALIZADA EXITOSAMENTE! <<<" -ForegroundColor Green
Write-Host "La aplicacion ya puede conectarse con las credenciales de su archivo .env:" -ForegroundColor Cyan
Write-Host "  DB_HOST=localhost"
Write-Host "  DB_PORT=3306"
Write-Host "  DB_USER=erp_admin"
Write-Host "  DB_PASSWORD=SecurePassword_2026!"
Write-Host "  DB_NAME=ero_erp_db"
