import { ApiJob } from '../apis/job';
import { ReactWrapper, shallow, ShallowWrapper } from 'enzyme';
import { Apis } from '../lib/Apis';
import { PageProps } from './Page';
import { RoutePage, RouteParams } from '../components/Router';
import TestUtils from '../TestUtils';
import RecurringRunDetails from './RecurringRunDetails';
import * as React from 'react';
import RecurringRunEdit from './RecurringRunEdit';
import { ButtonKeys } from '../lib/Buttons';

describe('EditRecurringRun', () => {
  let tree: ReactWrapper<any> | ShallowWrapper<any>;
  let fullTestJob: ApiJob = {};

  const updateBannerSpy = jest.fn();
  const updateDialogSpy = jest.fn();
  const updateSnackbarSpy = jest.fn();
  const updateToolbarSpy = jest.fn();
  const historyPushSpy = jest.fn();
  const getJobSpy = jest.spyOn(Apis.jobServiceApi, 'getJob');
  const updateJobSpy = jest.spyOn(Apis.jobServiceApi, 'updateJob');

  function generateProps(): PageProps {
    const match = {
      isExact: true,
      params: { [RouteParams.runId]: fullTestJob.id },
      path: '',
      url: '',
    };
    return TestUtils.generatePageProps(
      RecurringRunDetails,
      '' as any,
      match,
      historyPushSpy,
      updateBannerSpy,
      updateDialogSpy,
      updateToolbarSpy,
      updateSnackbarSpy,
    );
  }

  beforeEach(() => {
    fullTestJob = {
      created_at: new Date(2018, 8, 5, 4, 3, 2),
      description: 'test job description',
      enabled: true,
      id: 'test-job-id',
      max_concurrency: '50',
      no_catchup: true,
      name: 'test job',
      pipeline_spec: {
        parameters: [{ name: 'param1', value: 'value1' }],
        pipeline_id: 'some-pipeline-id',
      },
      trigger: {
        periodic_schedule: {
          end_time: new Date(2018, 10, 9, 8, 7, 6),
          interval_second: '3600',
          start_time: new Date(2018, 9, 8, 7, 6),
        },
      },
    } as ApiJob;

    jest.clearAllMocks();
    getJobSpy.mockImplementation(() => fullTestJob);
    updateJobSpy.mockImplementation(() => undefined);
  });

  afterEach(() => tree.unmount());

  it('renders the page with details filled in', async () => {
    tree = shallow(<RecurringRunEdit {...generateProps()} />);
    await TestUtils.flushPromises();
    expect(tree).toMatchSnapshot();
  });

  it('clears the banner when load is called', async () => {
    tree = shallow(<RecurringRunEdit {...(generateProps() as any)} />);
    expect(updateBannerSpy).toHaveBeenCalledTimes(1);
    (tree.instance() as RecurringRunEdit).load();
    await TestUtils.flushPromises();
    expect(updateBannerSpy).toHaveBeenCalledTimes(2);
    expect(updateBannerSpy).toHaveBeenLastCalledWith({});
  });

  it('has a refresh and delete button in the toolbar', () => {
    tree = shallow(<RecurringRunDetails {...generateProps()} />);
    const instance = tree.instance() as RecurringRunDetails;

    const refreshBtn = instance.getInitialToolbarState().actions[ButtonKeys.REFRESH];
    const deleteBtn = instance.getInitialToolbarState().actions[ButtonKeys.DELETE_RUN];

    expect(refreshBtn).toBeDefined();
    expect(deleteBtn).toBeDefined();
  });

  it('allows updating the recurring run name', async () => {
    tree = shallow(<RecurringRunEdit {...(generateProps() as any)} />);
    await TestUtils.flushPromises();

    tree
      .find('#runName')
      .at(0)
      .simulate('change', { target: { value: 'new run name' } });

    expect((tree.instance() as RecurringRunEdit).state.runName).toBe('new run name');
  });

  it('allows updating the description', async () => {
    tree = shallow(<RecurringRunEdit {...(generateProps() as any)} />);
    await TestUtils.flushPromises();

    tree
      .find('#description')
      .at(0)
      .simulate('change', { target: { value: 'new description' } });

    expect((tree.instance() as RecurringRunEdit).state.description).toBe('new description');
  });

  it('renders an error if required field is missing', async () => {
    tree = shallow(<RecurringRunEdit {...(generateProps() as any)} />);
    await TestUtils.flushPromises();

    tree
      .find('#runName')
      .at(0)
      .simulate('change', { target: { value: '' } });

    expect(
      tree
        .find('#errorMessage')
        .at(0)
        .text(),
    ).toBe('Run name is required');
  });

  it('renders a warning if a run param is missing', async () => {
    tree = shallow(<RecurringRunEdit {...(generateProps() as any)} />);
    await TestUtils.flushPromises();

    let p = (tree.instance() as RecurringRunEdit).state.parameters;
    p[0].value = '';
    (tree.instance() as RecurringRunEdit).setState({ parameters: p });

    expect(
      tree
        .find('#missingParametersMessage')
        .at(0)
        .text(),
    ).toBe('Some parameters are missing values');
  });

  it('exits to the recurring run details if cancels', async () => {
    tree = shallow(<RecurringRunEdit {...(generateProps() as any)} />);
    await TestUtils.flushPromises();

    tree.find('#cancelBtn').simulate('click');

    let id = (tree.instance() as RecurringRunEdit).state.run!.id!;
    let path = RoutePage.RECURRING_RUN.replace(':' + RouteParams.runId, id);
    expect(historyPushSpy).toHaveBeenCalledWith(path);
  });

  describe('clicks save', () => {
    it('save button is clickable', async () => {
      tree = shallow(<RecurringRunEdit {...(generateProps() as any)} />);
      await TestUtils.flushPromises();

      expect(
        tree
          .find('#saveBtn')
          .at(0)
          .prop('disabled'),
      ).toBeFalsy();
    });

    it('shows dialogue on error, re-enable save button', async () => {
      tree = shallow(<RecurringRunEdit {...(generateProps() as any)} />);
      await TestUtils.flushPromises();

      TestUtils.makeErrorResponseOnce(updateJobSpy, 'test error message');

      tree.find('#saveBtn').simulate('click');
      await TestUtils.flushPromises();

      expect(updateDialogSpy).toHaveBeenCalledTimes(1);
      expect(updateDialogSpy).toHaveBeenCalledWith({
        buttons: [{ text: 'Dismiss' }],
        content: 'test error message',
        title: 'Update failed',
      });
      expect((tree.instance() as RecurringRunEdit).state.isSaving).toBe(false);
    });

    it('sends update request', async () => {
      tree = shallow(<RecurringRunEdit {...(generateProps() as any)} />);
      await TestUtils.flushPromises();

      tree
        .find('#runName')
        .at(0)
        .simulate('change', { target: { value: 'new run name' } });
      tree.find('#saveBtn').simulate('click');

      let job = (tree.instance() as RecurringRunEdit).state.run;
      job!.description = 'new run name';
      expect(updateJobSpy).toHaveBeenCalledTimes(1);
      expect(updateJobSpy).toHaveBeenCalledWith(job);
    });

    it('exits to the recurring run details page', async () => {
      tree = shallow(<RecurringRunEdit {...(generateProps() as any)} />);
      await TestUtils.flushPromises();

      tree.find('#saveBtn').simulate('click');
      await TestUtils.flushPromises();

      const id = (tree.instance() as RecurringRunEdit).state.run!.id!;
      let path = RoutePage.RECURRING_RUN.replace(':' + RouteParams.runId, id);
      expect(historyPushSpy).toHaveBeenCalledTimes(1);
      expect(historyPushSpy).toHaveBeenCalledWith(path);
    });
  });
});
