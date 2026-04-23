export async function main(args) {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write("Usage: ccr [-set] [-show] [-reset]\n");
    return;
  }

  process.stdout.write("ccr\n");
}
