{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_20
    ollama
  ];

  shellHook = ''
    echo "AI Image Analyzer Development Environment"
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
    echo "Ollama version: $(ollama --version)"
  '';
}
