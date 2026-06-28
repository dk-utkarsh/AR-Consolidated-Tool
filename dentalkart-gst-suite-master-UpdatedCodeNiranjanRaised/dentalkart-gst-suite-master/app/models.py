from app.config import JOBS, JOBS_LOCK, MAX_JOBS


def store_job(job_id, data):
    with JOBS_LOCK:
        JOBS[job_id] = data
        while len(JOBS) > MAX_JOBS:
            JOBS.popitem(last=False)


def get_job(job_id):
    with JOBS_LOCK:
        return JOBS.get(job_id)
