"""Create an organiser sign-in for The Bond admin page.

Run it on your own computer:

    cd backend
    python make_organiser.py

It asks for an email and a password, hashes the password locally with bcrypt, and prints
the two environment-variable lines to paste into Render. Your actual password is never
written to a file, never stored anywhere, and never leaves this machine — only the hash
does, and a bcrypt hash cannot be turned back into the password.

To add a second organiser, run it again and join the pairs with a semicolon:

    ORGANISER_ACCOUNTS=first@example.com:$2b$12$...;second@example.com:$2b$12$...
"""

import getpass
import re
import secrets
import sys

try:
    from passlib.context import CryptContext
except ImportError:
    sys.exit("passlib is missing. Run: pip install -r requirements.txt")

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_LENGTH = 10


def main() -> None:
    print("\nThe Bond — create an organiser sign-in\n" + "-" * 38)

    email = input("Organiser email: ").strip().lower()
    if not EMAIL_RE.match(email):
        sys.exit("That does not look like an email address.")
    if ":" in email:
        sys.exit("An email containing ':' cannot be used here.")

    password = getpass.getpass(f"Password (at least {MIN_LENGTH} characters, hidden): ")
    if len(password) < MIN_LENGTH:
        sys.exit(f"Too short — use at least {MIN_LENGTH} characters.")
    if len(password.encode("utf-8")) > 72:
        sys.exit("Too long — bcrypt only reads the first 72 bytes. Use a shorter one.")
    if password != getpass.getpass("Confirm password: "):
        sys.exit("The two passwords did not match.")

    print("\nHashing…")
    password_hash = pwd.hash(password)

    print("\nDone. Add these to Render → your service → Environment:\n")
    print(f"ORGANISER_ACCOUNTS={email}:{password_hash}")
    print(f"AUTH_SECRET={secrets.token_urlsafe(48)}")
    print(
        "\nNotes"
        "\n  • AUTH_SECRET signs the sign-in tokens. Generate it once and keep it —"
        "\n    changing it later just signs everyone out."
        "\n  • Once both are set, the old ADMIN_PIN stops being accepted."
        "\n  • Never commit these values. Paste them straight into Render.\n"
    )


if __name__ == "__main__":
    main()
