// Backend job queue for heavy background tasks
// Processes expensive operations asynchronously without blocking requests

export interface Job<T = any> {
  id: string;
  type: string;
  data: T;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface JobHandler<T = any> {
  (job: Job<T>): Promise<void>;
}

export class JobQueue {
  private jobs = new Map<string, Job>();
  private handlers = new Map<string, JobHandler>();
  private processing = false;
  private batchSize = 10;
  private retryDelay = 5000; // 5 seconds

  /**
   * Register handler for job type
   */
  register<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler);
  }

  /**
   * Add job to queue
   */
  enqueue<T>(type: string, data: T, maxAttempts: number = 3): Job<T> {
    const job: Job<T> = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      data,
      status: 'pending',
      attempts: 0,
      maxAttempts,
      createdAt: new Date()
    };

    this.jobs.set(job.id, job);
    this.process(); // Try to process immediately
    return job;
  }

  /**
   * Get job status
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Process pending jobs
   */
  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const pendingJobs = Array.from(this.jobs.values())
        .filter(j => j.status === 'pending')
        .slice(0, this.batchSize);

      if (pendingJobs.length === 0) {
        this.processing = false;
        return;
      }

      await Promise.all(pendingJobs.map(job => this.processJob(job)));

      // Continue processing if more jobs
      setImmediate(() => this.process());
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process single job
   */
  private async processJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = 'failed';
      job.error = `No handler for job type: ${job.type}`;
      return;
    }

    try {
      job.status = 'processing';
      job.attempts++;
      await handler(job);
      job.status = 'completed';
      job.completedAt = new Date();
    } catch (error) {
      if (job.attempts < job.maxAttempts) {
        job.status = 'pending';
        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, this.retryDelay * Math.pow(2, job.attempts - 1))
        );
      } else {
        job.status = 'failed';
        job.error = String(error);
      }
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length
    };
  }

  /**
   * Clean up old completed/failed jobs
   */
  cleanup(olderThanMs: number = 3600000): void {
    const cutoff = Date.now() - olderThanMs;
    for (const [id, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.createdAt.getTime() < cutoff
      ) {
        this.jobs.delete(id);
      }
    }
  }
}

export const jobQueue = new JobQueue();
