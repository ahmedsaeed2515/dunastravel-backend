$ErrorActionPreference = 'Stop'

Write-Host "Downloading PostgreSQL using curl.exe..."
curl.exe -L -o postgres.zip "https://get.enterprisedb.com/postgresql/postgresql-16.3-1-windows-x64-binaries.zip"

Write-Host "Extracting PostgreSQL using tar..."
tar -xf postgres.zip

Write-Host "Initializing Database..."
.\pgsql\bin\initdb.exe -D .\pgsql\data -U postgres --auth=trust

Write-Host "Starting Database..."
.\pgsql\bin\pg_ctl.exe -D .\pgsql\data -l pg_log.txt start

Start-Sleep -Seconds 5

Write-Host "Setting Password and Creating DB..."
.\pgsql\bin\psql.exe -U postgres -c "ALTER USER postgres WITH PASSWORD 'password';"
.\pgsql\bin\psql.exe -U postgres -c "CREATE DATABASE dunastravel_db;"

Write-Host "PostgreSQL Setup Complete!"
