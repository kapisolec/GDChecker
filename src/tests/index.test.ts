// create basic jest test
import { helloWorld } from '../index';

// create basic jest test
describe('index', () => {
  it('should return true', () => {
    expect(helloWorld()).toBe(true);
  });
});
