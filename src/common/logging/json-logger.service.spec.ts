import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JsonLoggerService } from './json-logger.service';
import { AsyncContextService } from './async-context.service';
import { CORRELATION_ID_KEY } from './correlation-id.middleware';

describe('JsonLoggerService', () => {
  let service: JsonLoggerService;
  let configService: jest.Mocked<ConfigService>;
  let asyncContextService: jest.Mocked<AsyncContextService>;

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'LOG_LEVEL') return 'info';
        if (key === 'NODE_ENV') return 'production';
        return null;
      }),
    } as any;

    asyncContextService = {
      get: jest.fn().mockReturnValue('test-corr-id'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JsonLoggerService,
        { provide: ConfigService, useValue: configService },
        { provide: AsyncContextService, useValue: asyncContextService },
      ],
    }).compile();

    service = module.get<JsonLoggerService>(JsonLoggerService);

    // Spy on console.log
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should output valid JSON on log', () => {
    service.log('Test message', 'TestContext');

    expect(console.log).toHaveBeenCalledTimes(1);
    const outputString = (console.log as jest.Mock).mock.calls[0][0];

    expect(() => JSON.parse(outputString)).not.toThrow();

    const output = JSON.parse(outputString);
    expect(output.level).toBe('info');
    expect(output.message).toBe('Test message');
    expect(output.context).toBe('TestContext');
    expect(output.correlationId).toBe('test-corr-id');
    expect(output.nodeEnv).toBe('production');
    expect(output).toHaveProperty('timestamp');
  });

  it('should suppress logs below configured level', () => {
    // Configured level is 'info'
    service.debug('Debug message', 'TestContext');

    expect(console.log).not.toHaveBeenCalled();
  });

  it('should handle circular references safely', () => {
    const circularObj: any = { name: 'circular' };
    circularObj.self = circularObj;

    service.error(circularObj, 'trace', 'TestContext');

    expect(console.log).toHaveBeenCalledTimes(1);
    const outputString = (console.log as jest.Mock).mock.calls[0][0];

    expect(() => JSON.parse(outputString)).not.toThrow();
    const output = JSON.parse(outputString);

    // The message is converted to string if not string, wait, safeStringify handles it
    // Wait, the implementation of error uses safeStringify(message) which correctly handles circular objects.
    expect(output.message).toBeDefined();
  });
});
