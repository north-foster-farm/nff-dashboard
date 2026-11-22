"""Run a command on a pseudo-terminal and type one line into it.

Usage: python3 -I terminal.py ANSWER COMMAND [ARGS...]

The criteria tests for typed confirmation (nff-dashboard#74) need a
real terminal: the confirmation helper refuses outright when there is
none. The answer is typed as soon as the command starts; the terminal
holds it until the command reads a line. The command's output is passed
through, and its exit status is this script's.
"""

import os
import pty
import sys


def main():
    answer, argv = sys.argv[1], sys.argv[2:]
    pid, fd = pty.fork()
    if pid == 0:
        os.execvp(argv[0], argv)
    os.write(fd, (answer + "\n").encode())
    while True:
        try:
            chunk = os.read(fd, 4096)
        except OSError:
            break
        if not chunk:
            break
        sys.stdout.buffer.write(chunk)
        sys.stdout.flush()
    _, status = os.waitpid(pid, 0)
    sys.exit(os.waitstatus_to_exitcode(status))


if __name__ == "__main__":
    main()
