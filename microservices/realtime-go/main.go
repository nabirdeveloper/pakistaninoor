package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/rs/cors"
)

// Message types
const (
	MessageTypeChat       = "chat"
	MessageTypeComment    = "comment"
	MessageTypeNotification = "notification"
	MessageTypeTyping     = "typing"
	MessageTypeJoin       = "join"
	MessageTypeLeave      = "leave"
)

// Client represents a connected websocket client
type Client struct {
	ID       string
	UserID   string
	Username string
	Room     string
	Conn     *websocket.Conn
	Send     chan []byte
}

// Message represents a websocket message
type Message struct {
	Type      string    `json:"type"`
	Room      string    `json:"room"`
	UserID    string    `json:"userId,omitempty"`
	Username  string    `json:"username,omitempty"`
	Content   string    `json:"content,omitempty"`
	Data      any       `json:"data,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[*Client]bool
	rooms      map[string]map[*Client]bool
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
	mutex      sync.RWMutex
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in development
	},
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		broadcast:  make(chan Message, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mutex.Lock()
			h.clients[client] = true
			if _, ok := h.rooms[client.Room]; !ok {
				h.rooms[client.Room] = make(map[*Client]bool)
			}
			h.rooms[client.Room][client] = true
			h.mutex.Unlock()

			// Broadcast join message
			h.broadcast <- Message{
				Type:      MessageTypeJoin,
				Room:      client.Room,
				UserID:    client.UserID,
				Username:  client.Username,
				Timestamp: time.Now(),
			}

			log.Printf("Client %s joined room %s", client.ID, client.Room)

		case client := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				if _, ok := h.rooms[client.Room]; ok {
					delete(h.rooms[client.Room], client)
					if len(h.rooms[client.Room]) == 0 {
						delete(h.rooms, client.Room)
					}
				}
				close(client.Send)
			}
			h.mutex.Unlock()

			// Broadcast leave message
			h.broadcast <- Message{
				Type:      MessageTypeLeave,
				Room:      client.Room,
				UserID:    client.UserID,
				Username:  client.Username,
				Timestamp: time.Now(),
			}

			log.Printf("Client %s left room %s", client.ID, client.Room)

		case message := <-h.broadcast:
			h.mutex.RLock()
			clients, ok := h.rooms[message.Room]
			h.mutex.RUnlock()

			if ok {
				data, err := json.Marshal(message)
				if err != nil {
					log.Printf("Error marshaling message: %v", err)
					continue
				}

				for client := range clients {
					select {
					case client.Send <- data:
					default:
						h.mutex.Lock()
						close(client.Send)
						delete(h.clients, client)
						delete(h.rooms[message.Room], client)
						h.mutex.Unlock()
					}
				}
			}
		}
	}
}

func (c *Client) readPump(hub *Hub) {
	defer func() {
		hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512 * 1024) // 512KB max message size
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, data, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var message Message
		if err := json.Unmarshal(data, &message); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		message.UserID = c.UserID
		message.Username = c.Username
		message.Room = c.Room
		message.Timestamp = time.Now()

		hub.broadcast <- message
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current websocket message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func handleWebSocket(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}

		userID := r.URL.Query().Get("userId")
		username := r.URL.Query().Get("username")
		room := r.URL.Query().Get("room")

		if room == "" {
			room = "general"
		}

		client := &Client{
			ID:       generateID(),
			UserID:   userID,
			Username: username,
			Room:     room,
			Conn:     conn,
			Send:     make(chan []byte, 256),
		}

		hub.register <- client

		go client.writePump()
		go client.readPump(hub)
	}
}

// API Handlers

type CommentRequest struct {
	ProductID string `json:"productId"`
	UserID    string `json:"userId"`
	Username  string `json:"username"`
	Content   string `json:"content"`
	ParentID  string `json:"parentId,omitempty"`
}

func handlePostComment(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CommentRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Broadcast comment to product room
		hub.broadcast <- Message{
			Type:     MessageTypeComment,
			Room:     "product:" + req.ProductID,
			UserID:   req.UserID,
			Username: req.Username,
			Content:  req.Content,
			Data: map[string]string{
				"parentId": req.ParentID,
			},
			Timestamp: time.Now(),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "success",
		})
	}
}

type NotificationRequest struct {
	UserID  string `json:"userId"`
	Type    string `json:"type"`
	Title   string `json:"title"`
	Message string `json:"message"`
	Link    string `json:"link,omitempty"`
}

func handleSendNotification(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req NotificationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		// Send notification to user's personal room
		hub.broadcast <- Message{
			Type: MessageTypeNotification,
			Room: "user:" + req.UserID,
			Data: map[string]string{
				"type":    req.Type,
				"title":   req.Title,
				"message": req.Message,
				"link":    req.Link,
			},
			Timestamp: time.Now(),
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "success",
		})
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "healthy",
		"time":   time.Now().Format(time.RFC3339),
	})
}

func handleStats(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		hub.mutex.RLock()
		clientCount := len(hub.clients)
		roomCount := len(hub.rooms)
		rooms := make(map[string]int)
		for room, clients := range hub.rooms {
			rooms[room] = len(clients)
		}
		hub.mutex.RUnlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"totalClients": clientCount,
			"totalRooms":   roomCount,
			"rooms":        rooms,
		})
	}
}

func generateID() string {
	return time.Now().UnixNano()/int64(time.Millisecond) | 0x0 // Simple ID generation
}

func main() {
	hub := newHub()
	go hub.run()

	r := mux.NewRouter()

	// WebSocket endpoint
	r.HandleFunc("/ws", handleWebSocket(hub))

	// REST API endpoints
	r.HandleFunc("/health", handleHealth).Methods("GET")
	r.HandleFunc("/stats", handleStats(hub)).Methods("GET")
	r.HandleFunc("/api/comment", handlePostComment(hub)).Methods("POST")
	r.HandleFunc("/api/notification", handleSendNotification(hub)).Methods("POST")

	// CORS middleware
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	handler := c.Handler(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Real-time server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
