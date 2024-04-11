import { SortedDoubleLinkedList, DataWithTimestamp } from './messageHelper';
import 'zone.js';
import 'zone.js/testing';

let list: SortedDoubleLinkedList<DataWithTimestamp>;

beforeEach(() => {
  list = new SortedDoubleLinkedList<DataWithTimestamp>();
});

it('should insert data in sorted order', () => {
  const data1: DataWithTimestamp = {
    timestamp: 1,
    sender: 'Alice',
    msg: 'Hello',
    received: false,
  };
  const data2: DataWithTimestamp = {
    timestamp: 2,
    sender: 'Bob',
    msg: 'Hi',
    received: false,
  };
  const data3: DataWithTimestamp = {
    timestamp: 3,
    sender: 'Charlie',
    msg: 'Hey',
    received: false,
  };

  list.insert(data2);
  list.insert(data1);
  list.insert(data3);

  const allData = list.getAllData();
  expect(allData).toEqual([data1, data2, data3]);
});

it('should handle duplicate timestamps', () => {
  const data1: DataWithTimestamp = {
    timestamp: 1,
    sender: 'Alice',
    msg: 'Hello',
    received: false,
  };
  const data2: DataWithTimestamp = {
    timestamp: 2,
    sender: 'Bob',
    msg: 'Hi',
    received: false,
  };
  const data3: DataWithTimestamp = {
    timestamp: 2,
    sender: 'Charlie',
    msg: 'Hey',
    received: false,
  };

  list.insert(data2);
  list.insert(data1);
  list.insert(data3);

  const allData = list.getAllData();
  expect(allData).toEqual([data1, data3, data2]);
});

it('should set received attribute by timestamp', () => {
  const data1: DataWithTimestamp = {
    timestamp: 1,
    sender: 'Alice',
    msg: 'Hello',
    received: false,
  };
  const data2: DataWithTimestamp = {
    timestamp: 2,
    sender: 'Bob',
    msg: 'Hi',
    received: false,
  };
  const data3: DataWithTimestamp = {
    timestamp: 3,
    sender: 'Charlie',
    msg: 'Hey',
    received: false,
  };

  list.insert(data1);
  list.insert(data2);
  list.insert(data3);

  const result = list.setReceivedAttributeByTimestamp(2, 'Bob', 'Hi');
  expect(result).toBe(true);

  const updatedData = list.getAllData();
  expect(updatedData).toEqual([
    { timestamp: 1, sender: 'Alice', msg: 'Hello', received: false },
    { timestamp: 2, sender: 'Bob', msg: 'Hi', received: true },
    { timestamp: 3, sender: 'Charlie', msg: 'Hey', received: false },
  ]);
});

it('should return false if no matching data found', () => {
  const data1: DataWithTimestamp = {
    timestamp: 1,
    sender: 'Alice',
    msg: 'Hello',
    received: false,
  };
  const data2: DataWithTimestamp = {
    timestamp: 2,
    sender: 'Bob',
    msg: 'Hi',
    received: false,
  };
  const data3: DataWithTimestamp = {
    timestamp: 3,
    sender: 'Charlie',
    msg: 'Hey',
    received: false,
  };

  list.insert(data1);
  list.insert(data2);
  list.insert(data3);

  const result = list.setReceivedAttributeByTimestamp(4, 'Dave', 'Hey');
  expect(result).toBe(false);
});
