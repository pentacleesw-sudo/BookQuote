#!/bin/bash
open_p=$(grep -o "(" src/App.tsx | wc -l)
close_p=$(grep -o ")" src/App.tsx | wc -l)
echo "Open: $open_p"
echo "Close: $close_p"
