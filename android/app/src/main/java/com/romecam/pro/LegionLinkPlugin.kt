
package com.romecam.pro

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.net.ServerSocket
import java.net.Socket
import java.io.PrintWriter
import java.util.Scanner
import java.util.Timer
import java.util.TimerTask
import kotlin.concurrent.thread

@CapacitorPlugin(name = "LegionLink")
class LegionLinkPlugin : Plugin() {
    private var serverSocket: ServerSocket? = null
    private var clients = mutableListOf<Socket>()
    private var isLegatus = false
    private var heartbeatTimer: Timer? = null

    @PluginMethod
    fun initializeServer(call: PluginCall) {
        if (isLegatus) {
            call.resolve(JSObject().apply { put("status", "ALREADY_RUNNING") })
            return
        }

        isLegatus = true
        thread {
            try {
                serverSocket = ServerSocket(8080)
                startHeartbeatLoop()
                
                while (isLegatus) {
                    val client = serverSocket?.accept()
                    client?.let {
                        synchronized(clients) {
                            clients.add(it)
                        }
                        handleClient(it)
                    }
                }
            } catch (e: Exception) {
                isLegatus = false
                stopHeartbeatLoop()
                call.reject("Legion Server failure: ${e.message}")
            }
        }
        val ret = JSObject()
        ret.put("status", "SERVER_LISTENING")
        call.resolve(ret)
    }

    private fun startHeartbeatLoop() {
        heartbeatTimer?.cancel()
        heartbeatTimer = Timer()
        heartbeatTimer?.scheduleAtFixedRate(object : TimerTask() {
            override fun run() {
                if (isLegatus) {
                    broadcastSyncMessage("HEARTBEAT")
                }
            }
        }, 0, 5000) // 5 second heartbeats
    }

    private fun stopHeartbeatLoop() {
        heartbeatTimer?.cancel()
        heartbeatTimer = null
    }

    private fun handleClient(socket: Socket) {
        thread {
            try {
                val scanner = Scanner(socket.getInputStream())
                val writer = PrintWriter(socket.getOutputStream(), true)
                
                // Immediate Initial Sync Ping
                val syncMsg = JSObject()
                syncMsg.put("type", "SYNC")
                syncMsg.put("timestamp", System.currentTimeMillis())
                writer.println(syncMsg.toString())

                while (scanner.hasNextLine() && isLegatus) {
                    val input = scanner.nextLine()
                    val ret = JSObject()
                    ret.put("raw", input)
                    notifyListeners("onRemoteMessage", ret)
                }
            } catch (e: Exception) {
                // Client likely disconnected
            } finally {
                synchronized(clients) {
                    clients.remove(socket)
                }
                socket.close()
            }
        }
    }

    @PluginMethod
    fun broadcastCommand(call: PluginCall) {
        val type = call.getString("type") ?: "UNKNOWN"
        val payload = call.getObject("payload") ?: JSObject()
        
        broadcastSyncMessage(type, payload)
        call.resolve()
    }

    private fun broadcastSyncMessage(type: String, payload: JSObject = JSObject()) {
        val msg = JSObject()
        msg.put("type", type)
        msg.put("timestamp", System.currentTimeMillis())
        msg.put("payload", payload)
        val msgString = msg.toString()

        val disconnected = mutableListOf<Socket>()
        
        synchronized(clients) {
            clients.forEach { socket ->
                thread {
                    try {
                        val writer = PrintWriter(socket.getOutputStream(), true)
                        writer.println(msgString)
                    } catch (e: Exception) {
                        disconnected.add(socket)
                    }
                }
            }
            clients.removeAll(disconnected)
        }
    }

    @PluginMethod
    fun stopServer(call: PluginCall) {
        isLegatus = false
        stopHeartbeatLoop()
        try {
            serverSocket?.close()
            synchronized(clients) {
                clients.forEach { it.close() }
                clients.clear()
            }
        } catch (e: Exception) {}
        call.resolve()
    }

    @PluginMethod
    fun getSystemTime(call: PluginCall) {
        val ret = JSObject()
        ret.put("time", System.currentTimeMillis())
        call.resolve(ret)
    }
}
