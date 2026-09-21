# CI bumps url, sha256 and version per release before pushing this formula to the tap.
class TwodbNode < Formula
  desc "TwoDB node agent"
  homepage "https://github.com/reezpatel/twodb"
  version "0.1.0"
  url "https://github.com/reezpatel/twodb/releases/download/v0.1.0/twodb-node-darwin-arm64.tar.gz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"

  def install
    bin.install "twodb-node"
  end

  service do
    run [opt_bin/"twodb-node"]
    run_type :immediate
    keep_alive true
    environment_vars({
      PATH: stdlib_path,
      TWODB_NODE_URL: "http://localhost:3001",
      TWODB_NODE_TOKEN: "replace-me",
      TWODB_ROOT: "#{Dir.home}/.twodb",
    })
    log_path var/"log/twodb-node.log"
    error_log_path var/"log/twodb-node.error.log"
  end
end
