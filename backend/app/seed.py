import argparse

from app.database import clear_database, get_database_path, seed_database


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage the local SQLite database.")
    parser.add_argument(
        "command",
        choices=("seed", "clear", "reset"),
        help="seed mock data, clear all data, or clear then seed",
    )
    args = parser.parse_args()

    if args.command == "clear":
        clear_database()
        print(f"Cleared local database at {get_database_path()}")
        return

    if args.command == "reset":
        clear_database()

    seed_database()
    print(f"Seeded local database at {get_database_path()}")


if __name__ == "__main__":
    main()
