export const nodeActionType = {
  COMPUTATION: 'computation',
  API_CALL: 'api_call',
  RUN_CODE: 'run_code',
  SCHEDULE_TRIGGER: 'schedule_trigger',
  MANUAL_TRIGGER: 'manual_trigger',
}
export const triggerNode = [
    {
        name: 'Manual Trigger',
        actionType: nodeActionType.MANUAL_TRIGGER,
        icon: '',
        url: '',
        description:
          'Start the workflow manually from the UI or another explicit user action.',
        configuration: [],
      },
      {
        name: 'Schedule Trigger',
        actionType: nodeActionType.SCHEDULE_TRIGGER,
        icon: '',
        url: '',
        description:
          'Run the workflow automatically on a schedule, such as every hour or every day.',
        configuration: [
          {
            type: 'select',
            labelType: 'TRIGGER_ON',
            label: 'Trigger on',
            description: 'The schedule to run the workflow on.',
            required: true,
            default: {
              label: 'Every minute',
              value: 'min',
            },
            options: [
              {
                label: 'Every second',
                value: 'sec',
              },
              {
                label: 'Every minute',
                value: 'min',
              },
              {
                label: 'Every hour',
                value: 'hour',
              },
              {
                label: 'Every day',
                value: 'day',
              },
              {
                label: 'Every week',
                value: 'week',
              },
              {
                label: 'Every month',
                value: 'month',
              }
            ],
          },
          {
            type: 'number',
            labelType: 'INTERVAL_BETWEEN_TRIGGER',
            label: ' between trigger',
            description: 'The time between triggers.',
            required: true,
            default: '1'
          },
          {
            type: 'time',
            labelType: 'TIME_TO_TRIGGER',
            label: 'Time',
            description: 'The time to trigger the workflow at.',
            required: true,
            default: '00:00'
          }
        ],
      },
]


export const supportedNodeList = [
  {
    name: 'Run Code',
    actionType: nodeActionType.RUN_CODE,
    icon: '',
    url: '',
    description:
      'Run custom code logic directly within the workflow when this node is executed.',
    configuration: [
      {
        type: 'textarea',
        labelType: 'JAVASCRIPT_CODE',
        label: 'JavaScript Code',
        description: 'The JavaScript code to run.',
        required: true,
        default: 'console.log("Hello, world!")',
        language: 'javascript',
      }
    ]
  },  
  {
    name: 'API Call',
    actionType: nodeActionType.API_CALL,
    icon: '',
    url: '',
    description:
      'Call an external HTTP API endpoint and use its response in the workflow.',
    configuration: [
      {
        type: 'text',
        labelType: 'URL',
        label: 'URL',
        description: 'The URL to call.',
        required: true,
        default: 'https://api.example.com',
      },
      {
        type: 'text',
        labelType: 'HEADERS',
        label: 'Headers',
        description: 'The headers of the request.',
        required: false,
        default: '',
      },
      {
        type: 'select',
        labelType: 'METHOD',
        label: 'Method',
        description: 'The HTTP method to use.',
        required: true,
        default: 'GET',
        options: [
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
          { label: 'DELETE', value: 'DELETE' },
          { label: 'PATCH', value: 'PATCH' },
        ],
      },
      {
        type: 'textarea',
        labelType: 'BODY',
        label: 'Body',
        description: 'The body of the request.',
        required: false,
        default: '',
        language: 'json',
      }
    ],
  },
  {
    name: 'Computation',
    actionType: nodeActionType.COMPUTATION,
    icon: '',
    url: '',
    description:
      'Perform mathematical calculations, string manipulations, or other data transformations.',
    configuration: [
      {
        type: 'text',
        labelType: 'EXPRESSION_CODE',
        label: 'Expression Code',
        description: 'The expression to evaluate.',
        required: true,
        default: '1 + 1',
      }
    ],
  }
]