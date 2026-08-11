jest.retryTimes(0);

expect.extend({
  toBeOneOf(received, options) {
    const pass = options.includes(received);
    return {
      pass,
      message: () =>
        `expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to be one of ${JSON.stringify(options)}`
    };
  }
});
