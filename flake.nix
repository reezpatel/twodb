{
  description = "twodb";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        rec {
          twodb = pkgs.callPackage ./nix/package.nix { };
          default = twodb;
        }
      );

      nixosModules.default =
        { pkgs, lib, ... }:
        {
          imports = [ ./nix/nixos-module.nix ];
          services.twodb.package = lib.mkDefault self.packages.${pkgs.stdenv.hostPlatform.system}.twodb;
        };

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              pkgs.pnpm_10
            ];
          };
        }
      );
    };
}
