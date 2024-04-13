import { DataWithTimestamp, SortedDoubleLinkedList } from './messageHelper';
let list: SortedDoubleLinkedList<DataWithTimestamp>;

describe('MessageHelperTest', () => {
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

  it('should insert data at the correct place', () => {
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
    const data4: DataWithTimestamp = {
      timestamp: 4,
      sender: 'Dave',
      msg: 'Hola',
      received: false,
    };
    const data5: DataWithTimestamp = {
      timestamp: 5,
      sender: 'Peter',
      msg: 'Ahoi',
      received: false,
    };
    const data6: DataWithTimestamp = {
      timestamp: 6,
      sender: 'Maricel',
      msg: 'Bonjour',
      received: false,
    };

    list.insert(data4);
    list.insert(data2);
    list.insert(data6);
    list.insert(data1);
    list.insert(data5);
    list.insert(data3);

    const allData = list.getAllData();
    expect(allData).toEqual([data1, data2, data3, data4, data5, data6]);
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
    expect(allData).toEqual([data1, data2, data3]);
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

    const result1 = list.setReceivedAttributeByTimestamp(2, 'Bob', 'Hey');
    const result2 = list.setReceivedAttributeByTimestamp(2, 'Dave', 'Hi');
    const result3 = list.setReceivedAttributeByTimestamp(4, 'Alice', 'Hello');
    expect(result1).toBe(false);
    expect(result2).toBe(false);
    expect(result3).toBe(false);
  });
  it('should clear the list', () => {
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

    list.clear();

    const allData = list.getAllData();
    expect(allData).toEqual([]);
  });
});
