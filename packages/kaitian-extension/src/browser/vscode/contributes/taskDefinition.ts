import { Injectable, Autowired } from '@ali/common-di';
import { ITaskDefinitionRegistry } from '@ali/ide-core-common';
import { IJSONSchema, IJSONSchemaMap, localize, Logger } from '@ali/ide-core-browser';
import { VSCodeContributePoint, Contributes } from '../../../common';

export const taskDefinitionSchema: IJSONSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      description: localize('TaskDefinition.description', 'The actual task type. Please note that types starting with a \'$\' are reserved for internal usage.'),
    },
    required: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    properties: {
      type: 'object',
      description: localize('TaskDefinition.properties', 'Additional properties of the task type'),
      additionalProperties: {
        $ref: 'http://json-schema.org/draft-04/schema#',
      },
    },
  },
};

export interface TaskDefinition {
  type: string;
  required: string[];
  properties: IJSONSchemaMap;
}

export type ITaskDefinitionSchema = Array<TaskDefinition>;

@Injectable()
@Contributes('taskDefinitions')
export class TaskDefinitionContributionPoint extends VSCodeContributePoint<ITaskDefinitionSchema> {

  @Autowired(ITaskDefinitionRegistry)
  taskDefinitionRegistry: ITaskDefinitionRegistry;

  @Autowired(Logger)
  logger: Logger;

  contribute() {
    for (const definition of this.json) {
      this.logger.verbose(`${this.extension.id} register taskDefinition ${JSON.stringify(definition)}`);
      this.addDispose(this.taskDefinitionRegistry.register(definition.type, {
        ...definition,
        taskType: definition.type,
        extensionId: this.extension.id,
      }));
    }
  }
}
