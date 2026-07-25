{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
  	llama-cpp
    nodejs_24
    (pkgs.ollama.override {
	  acceleration = "rocm";
	})
  ];

  shellHook = ''
    echo "AI Image Analyzer Development Environment"
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
    echo "Ollama version: $(ollama --version)"
  '';
}
