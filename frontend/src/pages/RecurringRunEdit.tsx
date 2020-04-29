/*
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import Buttons from '../lib/Buttons';
import RunUtils from '../lib/RunUtils';
import { ApiExperiment } from '../apis/experiment';
import { ApiJob, ApiTrigger } from '../apis/job';
import { Apis } from '../lib/Apis';
import { Page } from './Page';
import { RoutePage, RouteParams } from '../components/Router';
import { Breadcrumb, ToolbarProps } from '../components/Toolbar';
import { classes } from 'typestyle';
import { commonCss, padding } from '../Css';
import { errorToMessage, logger } from '../lib/Utils';
import Input from '../atoms/Input';
import { TextFieldProps } from '@material-ui/core/TextField';
import Trigger from '../components/Trigger';
import BusyButton from '../atoms/BusyButton';
import Button from '@material-ui/core/Button';
import RunParameters from '../components/RunParameters';
import { ApiParameter } from '../apis/pipeline';

interface EditRecurringRunState {
  run?: ApiJob;
  runName: string;
  description: string;
  serviceAccount: string;
  trigger?: ApiTrigger;
  maxConcurrentRuns: string;
  catchup: boolean;
  parameters: ApiParameter[];
  errorMessage: string;
  isSaving: boolean;
}

class RecurringRunEdit extends Page<{}, EditRecurringRunState> {
  public state: EditRecurringRunState = {
    runName: '',
    description: '',
    serviceAccount: '',
    maxConcurrentRuns: '',
    catchup: true,
    parameters: [],
    errorMessage: '',
    isSaving: false,
  };

  public getInitialToolbarState(): ToolbarProps {
    const buttons = new Buttons(this.props, this.refresh.bind(this));
    return {
      actions: buttons
        .refresh(this.refresh.bind(this))
        .delete(
          () => (this.state.run ? [this.state.run!.id!] : []),
          'recurring run config',
          this._deleteCallback.bind(this),
          true /* useCurrentResource */,
        )
        .getToolbarActionMap(),
      breadcrumbs: [],
      pageTitle: '',
    };
  }

  public render(): JSX.Element {
    const {
      run,
      runName,
      description,
      serviceAccount,
      trigger,
      maxConcurrentRuns,
      catchup,
      parameters,
      errorMessage,
      isSaving,
    } = this.state;

    return (
      <div className={classes(commonCss.page, padding(20, 'lr'))}>
        {!!run && (
          <div className={commonCss.page}>
            <div className={padding(10, 't')}>
              <div className={commonCss.header}>General Params</div>

              <Input
                id='runName'
                label='Run name'
                required={true}
                multiline={false}
                onChange={this._handleChange('runName')}
                value={runName}
                error={runName === ''}
                variant='outlined'
              />

              <Input
                id='description'
                label='Description'
                multiline={false}
                onChange={this._handleChange('description')}
                value={description}
                variant='outlined'
              />

              <Input
                id='serviceAccount'
                label='Service Account'
                multiline={false}
                onChange={this._handleChange('serviceAccount')}
                value={serviceAccount}
                variant='outlined'
              />

              <div className={commonCss.header}>Run trigger</div>

              <Trigger
                trigger={trigger}
                maxConcurrentRuns={maxConcurrentRuns}
                catchup={catchup || true}
                onChange={({ trigger, maxConcurrentRuns, catchup }) =>
                  this._updateRunTriggers(trigger, maxConcurrentRuns, catchup)
                }
              />

              {!!parameters && (
                <RunParameters
                  initialParams={parameters}
                  titleMessage={
                    parameters.length > 0
                      ? 'Edit pipeline parameters'
                      : 'This pipeline has no parameters'
                  }
                  handleParamChange={this._handleParamChange.bind(this)}
                />
              )}
            </div>

            <div className={classes(commonCss.flex, padding(40, 'tb'))}>
              <BusyButton
                id='saveBtn'
                disabled={!!errorMessage}
                busy={isSaving}
                className={commonCss.buttonAction}
                title='Save'
                onClick={this._save.bind(this)}
              />
              <Button id='cancelBtn' onClick={this._goToRecurringDetailsPage.bind(this)}>
                Cancel
              </Button>

              <div id='errorMessage' className={classes(padding(20, 'r'))} style={{ color: 'red' }}>
                {errorMessage}
              </div>

              {this._areParametersMissing() && (
                <div id='missingParametersMessage' style={{ color: 'orange' }}>
                  Some parameters are missing values
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  private _handleChange = (name: string) => (event: any) => {
    const value = (event.target as TextFieldProps).value;
    this.setStateSafe({ [name]: value } as any, () => {
      this._validate();
    });
  };

  private _updateRunTriggers(
    trigger: ApiTrigger | undefined,
    maxConcurrentRuns: string | undefined,
    catchup: boolean,
  ) {
    this.setStateSafe(
      {
        trigger,
        maxConcurrentRuns,
        catchup,
      },
      () => this._validate(),
    );
  }

  private _handleParamChange(index: number, value: string): void {
    const { parameters } = this.state;
    if (!!parameters && parameters.length > index) {
      parameters[index].value = value;
      this.setStateSafe({ parameters });
    }
  }

  private _validate(): void {
    const { maxConcurrentRuns, runName, trigger } = this.state;
    try {
      if (!runName) {
        throw new Error('Run name is required');
      }

      RunUtils.ensureRecurringRunParamsAreValid(trigger, maxConcurrentRuns);

      this.setStateSafe({ errorMessage: '' });
    } catch (err) {
      this.setStateSafe({ errorMessage: err.message });
    }
  }

  public componentDidMount(): Promise<void> {
    return this.load();
  }

  public async refresh(): Promise<void> {
    await this.load();
  }

  public async load(): Promise<void> {
    this.clearBanner();
    const runId = this.props.match.params[RouteParams.runId];

    let run: ApiJob;
    try {
      run = await Apis.jobServiceApi.getJob(runId);
    } catch (err) {
      const errorMessage = await errorToMessage(err);
      await this.showPageError(
        `Error: failed to retrieve recurring run: ${runId}.`,
        new Error(errorMessage),
      );
      return;
    }

    const relatedExperimentId = RunUtils.getFirstExperimentReferenceId(run);
    let experiment: ApiExperiment | undefined;
    if (relatedExperimentId) {
      try {
        experiment = await Apis.experimentServiceApi.getExperiment(relatedExperimentId);
      } catch (err) {
        const errorMessage = await errorToMessage(err);
        await this.showPageError(
          `Error: failed to retrieve this recurring run's experiment.`,
          new Error(errorMessage),
          'warning',
        );
      }
    }
    const breadcrumbs: Breadcrumb[] = [];
    if (experiment) {
      breadcrumbs.push(
        { displayName: 'Experiments', href: RoutePage.EXPERIMENTS },
        {
          displayName: experiment.name!,
          href: RoutePage.EXPERIMENT_DETAILS.replace(
            ':' + RouteParams.experimentId,
            experiment.id!,
          ),
        },
      );
    } else {
      breadcrumbs.push({ displayName: 'All runs', href: RoutePage.RUNS });
    }
    const pageTitle = 'Edit recurring run';

    this.props.updateToolbar({ breadcrumbs, pageTitle });

    this.setState({
      run,
      runName: run.name || '',
      description: run.description || '',
      serviceAccount: run.service_account || '',
      trigger: run.trigger,
      maxConcurrentRuns: run.max_concurrency || '',
      catchup: !run.no_catchup,
      parameters: run.pipeline_spec?.parameters || [],
    });
  }

  private _deleteCallback(_: string[], success: boolean): void {
    if (success) {
      const breadcrumbs = this.props.toolbarProps.breadcrumbs;
      const previousPage = breadcrumbs.length
        ? breadcrumbs[breadcrumbs.length - 1].href
        : RoutePage.EXPERIMENTS;
      this.props.history.push(previousPage);
    }
  }

  private _areParametersMissing(): boolean {
    const { parameters } = this.state;
    return parameters?.some(p => !p.value);
  }

  private _goToRecurringDetailsPage(): void {
    const { run } = this.state;
    this.props.history.push(
      !!run?.id ? RoutePage.RECURRING_RUN.replace(':' + RouteParams.runId, run.id) : RoutePage.RUNS,
    );
  }

  private _save(): void {
    this.setStateSafe({ isSaving: true }, async () => {
      try {
        let updatedRun = this.state.run;

        if (!updatedRun || !updatedRun.pipeline_spec) {
          throw new Error('run object is not properly undefined');
        }

        updatedRun.name = this.state.runName;
        updatedRun.description = this.state.description;
        updatedRun.trigger = this.state.trigger;
        updatedRun.max_concurrency = this.state.maxConcurrentRuns;
        updatedRun.no_catchup = !this.state.catchup;
        updatedRun.pipeline_spec.parameters = this.state.parameters;

        await Apis.jobServiceApi.updateJob(updatedRun);

        this._goToRecurringDetailsPage();

        // TODO: snackbars are not working (trying to set state (in RoutePage) whilst unmounting is returning an error)
        // NewRun page also does not create a snackbar when create is clicked
        // this.props.updateSnackbar({
        //   message: `Successfully updated Run: ${updatedRun.name}`,
        //   open: true,
        // });
      } catch (err) {
        const errorMessage = await errorToMessage(err);
        this.showErrorDialog('Update failed', errorMessage);
        logger.error('Error updating Run:', err);
        return;
      } finally {
        this.setStateSafe({ isSaving: false });
      }
    });
  }
}

export default RecurringRunEdit;
