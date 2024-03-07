import websocket
import select
import sys
import json

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
PURPLE = "\033[95m"
CYAN = "\033[96m"
RESET = "\033[0;0m"
BOLD = "\033[;1m"

HOST = "127.0.0.1"
PORT = 5000
user = ""
groupname = "default"
separator = "&&&"  # same as of server
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


ws = websocket.WebSocket()

ws.connect("ws://" + HOST + ":" + str(PORT) + "/")

groups = json.loads(ws.recv())

# set chat room
printList("CHAT ROOMS", groups)

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

response = json.loads(ws.recv())

if response["operation"] == "GROUP_JOINED" or response["operation"] == "GROUP_CREATED":
    print(f"{BOLD}{YELLOW}INFO>{RESET} Connected to host. Start sending messages.")
    print(helpMsg)
    print(f"{PURPLE}Joined {YELLOW}{groupname}{PURPLE} group as {YELLOW}{user}{RESET}")
else:
    print(f"{BOLD}{RED}ERROR> Cannot have same names{RESET}")
    sys.exit()


while True:
    sys.stdout.flush()
    sys.stdout.write("\r\033[K")
    sys.stdout.write(BOLD + GREEN + user + "> " + RESET)
    sys.stdout.flush()
    socket_list = [sys.stdin, ws]
    # get the list sockets which are readable
    read_sockets, _, _ = select.select(socket_list, [], [])
    for sock in read_sockets:
        # handle incoming message from remote server
        if sock == ws:
            data = json.loads(sock.recv())
            if not data:
                sys.stdout.write(BOLD + RED)
                sys.stdout.write("Disconnected from chat server")
                sys.stdout.write(RESET)
                sys.exit()
            else:
                # receive user messages
                # clears self stdin (bug like thingy)
                incoming_user = data["payload"]["user"]
                incoming_msg = data["payload"]["msg"]
                sys.stdout.write("\r\033[K")
                sys.stdout.flush()
                if incoming_user == user:
                    continue
                elif incoming_user == "SERVER_INFO":
                    # information
                    sys.stdout.write(BOLD + YELLOW)
                    sys.stdout.write("INFO" + "> " + incoming_msg + "\n")
                else:
                    # normal message
                    sys.stdout.write(BOLD + CYAN)
                    sys.stdout.write(incoming_user + "> " + incoming_msg + "\n")
                sys.stdout.write(RESET)

                # other wise show list of users online
                # not to best way to handle responses
                # printList("PEOPLE ONLINE", data)
        # send message
        else:
            msg = sys.stdin.readline().strip()
            if msg == "EXIT":
                print("Bye,", user)
                sys.exit()
            elif msg == "CLEAR":
                print("\x1b[2J\x1b[H")
            elif msg == "HELP":
                print(helpMsg)
            elif len(msg) > 0:
                ws.send(
                    json.dumps(
                        {
                            "operation": "SEND_MESSAGE",
                            "payload": {
                                "groupname": groupname,
                                "user": user,
                                "msg": msg,
                            },
                        }
                    )
                )
