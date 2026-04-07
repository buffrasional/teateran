#!/bin/bash
cd /home/z/my-project
set -a
source .env 2>/dev/null
set +a
exec npx next start -p 3000
