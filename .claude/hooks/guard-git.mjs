// Refuse the two git flags that quietly undo this project's safety nets.
//
// `--no-verify` skips every pre-commit hook, including the ones that do run on
// this machine; the correct way past the three that Windows app-control policy
// blocks is SKIP=<their names>, which leaves the rest working. Force-pushing
// rewrites published history, and nothing here has ever needed it.
//
// Wired as a PreToolUse hook on Bash: exit 2 blocks the call and shows stderr
// to the agent, which can then run the corrected command.
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let command = "";
  try {
    command = JSON.parse(input).tool_input?.command ?? "";
  } catch {
    process.exit(0); // not something this hook understands; let it through
  }

  const code = withoutHeredocs(command);
  if (!/\bgit\b/.test(code)) {
    process.exit(0);
  }

  if (/\bgit\s+(?:-\S+\s+)*commit\b[^\n;|&]*(?:--no-verify|\s-\w*n\w*\b)/.test(code)) {
    refuse(
      "--no-verify disables every pre-commit hook, not just the three that " +
        "cannot run on this machine.\nSkip those by name instead:\n" +
        "  SKIP=commitizen,end-of-file-fixer,check-added-large-files git commit -m '...'"
    );
  }

  if (/\bgit\s+(?:-\S+\s+)*push\b[^\n;|&]*(?:--force(?!-with-lease)|\s-f\b)/.test(code)) {
    refuse(
      "Force-pushing rewrites published history, and this project has never " +
        "needed it.\nIf a branch really must be rewritten, ask first and say why."
    );
  }

  process.exit(0);
});

function refuse(message) {
  console.error("Refused: " + message);
  process.exit(2);
}

// Strip heredoc bodies before looking for flags.
//
// A command that WRITES about these flags - documentation, a commit message, a
// pull request body - carries them as ordinary text inside `<<'EOF' ... EOF`,
// and matching there would block writing this very file. Only what the shell
// would execute is worth inspecting.
function withoutHeredocs(command) {
  const opener = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g;
  let result = "";
  let cursor = 0;
  let match;

  while ((match = opener.exec(command)) !== null) {
    const marker = match[2];
    const bodyStart = command.indexOf("\n", opener.lastIndex);
    if (bodyStart === -1) {
      break;
    }
    const end = command.indexOf("\n" + marker, bodyStart);
    const bodyEnd = end === -1 ? command.length : end + marker.length + 1;

    result += command.slice(cursor, opener.lastIndex);
    cursor = bodyEnd;
    opener.lastIndex = bodyEnd;
  }

  return result + command.slice(cursor);
}
