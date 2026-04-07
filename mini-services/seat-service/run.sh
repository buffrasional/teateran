#!/bin/bash
cd /home/z/my-project/mini-services/seat-service
exec node server.js >> /tmp/seat-service.log 2>&1
