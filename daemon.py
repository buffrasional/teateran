#!/usr/bin/env python3
import os
import sys

# Read .env and set environment variables
env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                key = k.strip()
                val = v.strip()
                # Strip surrounding quotes
                if len(val) >= 2:
                    if (val[0] == '"' and val[-1] == '"') or (val[0] == "'" and val[-1] == "'"):
                        val = val[1:-1]
                os.environ[key] = val

# Double fork to survive container init process
pid = os.fork()
if pid > 0:
    os._exit(0)

os.setsid()

pid = os.fork()
if pid > 0:
    os._exit(0)

# Start the standalone server
standalone_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.next', 'standalone')
os.chdir(standalone_dir)
os.execvp('node', ['node', 'server.js'])
