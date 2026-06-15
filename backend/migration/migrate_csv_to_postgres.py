from backend.migration.pipeline.common import *  # noqa: F401,F403
from backend.migration.pipeline.steps import *  # noqa: F401,F403
from backend.migration.pipeline.runner import cleanup_clinic_migration, main, migrate


if __name__ == "__main__":
    main()
