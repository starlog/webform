#!/bin/bash
if [ -z "$1" ]; then
  echo "Usage: ./killport.sh <port>"
  exit 1
fi
pid=$(lsof -ti :"$1")
if [ -z "$pid" ]; then
  echo "No process found on port $1"
  exit 0
fi
kill -9 $pid
echo "Killed process $pid on port $1"
