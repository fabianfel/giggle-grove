from threading import Thread
import websocket
import requests
import json
import sys
import time

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
PURPLE = "\033[95m"
CYAN = "\033[96m"
RESET = "\033[0;0m"
BOLD = "\033[;1m"
user = ""
groupname = "default"

helpMsg = f"""{PURPLE}\
    LIST  => to get list of people online\n\
    @name => to reply send message to specific person\n\
    CLEAR => clear screen\n\
    HELP  => display this help message\n\
    EXIT  => exit.{RESET}"""

def printList(msg, list):
    sys.stdout.write("\r\033[K")
    sys.stdout.flush()
    print(YELLOW + "<---- " + msg + " ---->", RESET)
    for object in list:
        print(GREEN + "*" + RESET, object)
    print()

def on_message(_, message):
    data = json.loads(message)
    if data["operation"] == "GROUP_JOINED" or data["operation"] == "GROUP_CREATED":
        print(f"{BOLD}{YELLOW}INFO>{RESET} Connected to host. Start sending messages.")
        print(helpMsg)
        print(f"{PURPLE}Joined {YELLOW}{groupname}{PURPLE} group as {YELLOW}{user}{RESET}")
    elif data["operation"] == "NEW_MESSAGE":
        incoming_user = data["payload"]["user"]
        incoming_msg = data["payload"]["msg"]
        if incoming_user != user:
            sys.stdout.write("\r\033[K")
            sys.stdout.flush()
            if incoming_user == "SERVER_INFO":
                print(BOLD + YELLOW + "INFO" + "> " + incoming_msg + RESET)
            else:
                print(BOLD + CYAN + incoming_user + "> " + incoming_msg + RESET)
            sys.stdout.write(f"{GREEN}{user}> {RESET}")
            sys.stdout.flush()
    else:
        print(f"{BOLD}{RED}ERROR> Cannot have same names{RESET}")
        sys.exit()

def on_error(_, error):
    print(error)

def on_close(_):
    print("### closed ###")

def on_open(_):
    print("Opened connection")

def get_group_info():
    url = "http://127.0.0.1:5000/groups"
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()
    else:
        return None

def main():
    global user
    global groupname

    group_info = get_group_info()
    if group_info is None:
        print("Failed to retrieve group information. Exiting.")
        return

    ws = websocket.WebSocketApp(
        "ws://127.0.0.1:5000/",
        on_open=on_open,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close
    )
    Thread(target=ws.run_forever).start()

    time.sleep(0.1)
    # set chat room
    printList("CHAT ROOMS", group_info)

    group_input = input(f"{PURPLE}Join a Chat Room or Create New: {YELLOW}").replace(
        " ", ""
    )
    if group_input != "":
        groupname = group_input

    while user == "":
        user = input(f"{PURPLE}Enter your Name: {YELLOW}").replace(" ", "")

    print(RESET)

    ws.send(
        json.dumps(
            {
                "operation": "CREATE_OR_JOIN_GROUP",
                "payload": {"user": user, "groupname": groupname},
            }
        )
    )

    time.sleep(0.1)

    print(f"{PURPLE}You can now chat with others. Type 'HELP' for more options.{RESET}")
    while True:
        message = input(f"{GREEN}{user}> {RESET}")
        sys.stdout.flush()
        if message.upper() == "EXIT":
            print("Bye,", user)
            ws.close()
            sys.exit()
        elif message.upper() == "CLEAR":
            print("\x1b[2J\x1b[H")
        elif message.upper() == "HELP":
            print(helpMsg)
        elif len(message.upper()) > 0:
            ws.send(
                json.dumps(
                    {
                        "operation": "SEND_MESSAGE",
                        "payload": {
                            "groupname": groupname,
                            "user": user,
                            "msg": message,
                        },
                    }
                )
            )

if __name__ == "__main__":
    main()
