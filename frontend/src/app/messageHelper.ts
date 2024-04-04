interface DataWithTimestamp {
  timestamp: number;
  groupname?: string;
  sender?: string;
  msg?: string;
}

class Node<T extends DataWithTimestamp> {
  data: T;
  next: Node<T> | null;

  constructor(data: T) {
    this.data = data;
    this.next = null;
  }
}

export class SortedLinkedList<T extends DataWithTimestamp> {
  private head: Node<T> | null;

  constructor() {
    this.head = null;
  }

  insert(data: T): void {
    const newNode = new Node(data);
    if (!this.head || data.timestamp < this.head.data.timestamp) {
      newNode.next = this.head;
      this.head = newNode;
    } else {
      let current = this.head;
      while (current.next && data.timestamp >= current.next.data.timestamp) {
        current = current.next;
      }
      newNode.next = current.next;
      current.next = newNode;
    }
  }

  getAllData(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      result.push(current.data);
      current = current.next;
    }
    return result;
  }

  getDataByTimestamp(timestamp: number): T | null {
    let left = this.head;
    let right: Node<T> | null = null;

    while (left) {
      if (left.data.timestamp === timestamp) {
        return left.data;
      } else if (left.data.timestamp < timestamp) {
        right = left;
        left = left.next;
      } else {
        break; // Zeitstempel nicht gefunden
      }
    }

    // Überprüfen, ob das Element mit dem gesuchten Zeitstempel gefunden wurde
    if (right && right.data.timestamp === timestamp) {
      return right.data;
    } else {
      return null; // Element mit dem gesuchten Zeitstempel nicht gefunden
    }
  }
}
