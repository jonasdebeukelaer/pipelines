import { ApiCronSchedule, ApiPeriodicSchedule, ApiTrigger } from '../apis/job/api';
import RunUtils from './RunUtils';

describe('RunUtils', () => {
  describe('recurringParamsAreValid', () => {
    let now = new Date();

    let later = new Date(now);
    later.setDate(later.getDate() + 1);
    let validApiTrigger = {
      cron_schedule: {
        start_time: now,
        end_time: later,
        cron: '0 5 10 ? * 1,2',
      } as ApiCronSchedule,
    } as ApiTrigger;

    it('error if trigger undefined', () => {
      expect(() => RunUtils.ensureRecurringRunParamsAreValid(undefined, '1')).toThrowError(
        'trigger undefined',
      );
    });

    it('error if maxConcurrentRuns 0', () => {
      expect(() => RunUtils.ensureRecurringRunParamsAreValid(validApiTrigger, '0')).toThrowError(
        'Maximum concurrent runs must be in range [1, 10]',
      );
    });

    it('error if maxConcurrentRuns not number', () => {
      expect(() => RunUtils.ensureRecurringRunParamsAreValid(validApiTrigger, 'word')).toThrowError(
        'Maximum concurrent runs must be in range [1, 10]',
      );
    });

    it('error if no weekday selected', () => {
      let noWeekCronTrigger = {
        cron_schedule: {
          end_time: later,
          cron: '0 0 9 ? *',
        } as ApiCronSchedule,
      } as ApiTrigger;
      expect(() => RunUtils.ensureRecurringRunParamsAreValid(noWeekCronTrigger, '1')).toThrowError(
        'Cron schedule invalid',
      );
    });

    it('ok for valid values', () => {
      expect(RunUtils.ensureRecurringRunParamsAreValid(validApiTrigger, '5')).toBe();
    });
  });
});
