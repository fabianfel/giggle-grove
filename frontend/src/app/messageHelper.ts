interface DataWithTimestamp {
  timestamp: number;
  groupname?: string;
  sender?: string;
  msg?: string;
  received?: boolean;
}

class Node<T extends DataWithTimestamp> {
  data: T;
  next: Node<T> | null;
  prev: Node<T> | null;

  constructor(data: T) {
    this.data = data;
    this.next = null;
    this.prev = null;
  }
}

export class SortedDoubleLinkedList<T extends DataWithTimestamp> {
  private head: Node<T> | null;
  private tail: Node<T> | null;

  constructor() {
    this.head = null;
    this.tail = null;
  }

  insert(data: T): void {
    const newNode = new Node(data);

    if (!this.head) {
      this.head = newNode;
      this.tail = newNode;
      return;
    }

    let current: Node<T> | null = this.head; // initialisiere current mit dem Kopf der Liste
    let prev: Node<T> | null = null;

    while (current) {
      if (data.timestamp === current.data.timestamp) {
        // Wenn der Zeitstempel bereits in der Liste vorhanden ist,
        // erhöhe den Zeitstempel des neuen Knotens um 1
        data.timestamp++;
      }

      if (data.timestamp < current.data.timestamp) {
        // Füge den neuen Knoten vor dem aktuellen Knoten ein
        newNode.next = current;
        newNode.prev = prev;
        if (prev) {
          prev.next = newNode;
        } else {
          this.head = newNode; // Der neue Knoten ist jetzt der neue Kopf der Liste
        }
        current.prev = newNode;
        return;
      }

      // Gehe zum nächsten Knoten weiter
      prev = current;
      current = current.next;
    }

    // Füge den neuen Knoten am Ende der Liste ein
    if (prev) {
      prev.next = newNode;
    }
    newNode.prev = prev;
    this.tail = newNode; // Der neue Knoten ist jetzt das letzte Element der Liste
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

  setReceivedAttributeByTimestamp(
    timestamp: number,
    sender: string,
    message: string
  ): T | boolean {
    let current = this.tail;
    while (current) {
      if (current.data.timestamp === timestamp) {
        if (current.data.sender === sender && current.data.msg === message) {
          current.data.received = true;
          return true;
        }
      }
      current = current.prev;
    }
    return false;
  }
}
