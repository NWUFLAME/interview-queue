const express = require('express')
const app = express()
const { v4: uuidv4 } = require('uuid');

const userInfoMiddleware = function (req, res, next) {
    req.loginUser = req.query.uid
    next()
}

app.use(userInfoMiddleware)

// 房间号和房间实例映射表
const idRoomMap = new Map();
// 用户状态哈希表，用于优化查找时间复杂度到O(1)
const userMap = new Map();

// 创建面试房间
app.get("/createRoom", (req, res)=> {
    const roomId = uuidv4();
    idRoomMap.set(roomId,new Room(roomId));
    res.send(roomId);
})
// 获取当前状态
app.get("/getStatus", (req, res)=> {
    const loginUser = req.loginUser
    if (!userMap.has(loginUser)) {
        return '您还没有加入房间'
    }
    const user = userMap.get(loginUser)
    res.send(`您当前在房间${user.roomId}中${user.type === USER_TYPE.EE ? '作为求职者':'作为面试官'}${user.status === USER_STATUS.IDLE ? '等待面试':'进行面试中'}`)
})
// 面试官加入房间
app.get("/interviewerEnroll/:roomId",(req, res) =>{
    const loginUser = req.loginUser
    const roomId = req.params.roomId
    // 当前不在任何房间才继续执行
    if (userMap.has(loginUser)) {
        return '您已经在房间中, 不能加入房间'
    }
    const room = idRoomMap.get(roomId);
    if (!room) {
        res.send('房间不存在，加入失败')
        return
    }
    res.send(room.interviewerEnroll(loginUser))
})

// 求职者加入房间
app.get("/intervieweeEnroll/:roomId", (req, res) => {
    const roomId = req.params.roomId
    const loginUser = req.loginUser
    // 当前不在任何房间才继续执行
    if (userMap.has(loginUser)) {
        return '您已经在房间中, 不能加入房间'
    }
    const room = idRoomMap.get(roomId);
    if (!room) {
        res.send('房间不存在, 加入失败')
        return
    }
    res.send(room.intervieweeEnroll(loginUser))
})

// 退出房间
app.get("/exit",(req, res) =>{
    const loginUser = req.loginUser
    if (!userMap.has(loginUser)) {
        return res.send('您还没有加入房间，退出失败')
    }
    const user = userMap.get(loginUser)
    const room = idRoomMap.get(user.roomId)
    if (user.type === USER_TYPE.ER) {
        res.send(room.interviewerExit(loginUser))
    } else {
        res.send(room.intervieweeExit(loginUser))
    }
})
// 面试官结束面试
app.get("/finish",(req, res) =>{
    const loginUser = req.loginUser
    if (!userMap.has(loginUser)) {
        return res.send('您还没有加入房间，结束面试操作无效')
    }
    const user = userMap.get(loginUser)
    const room = idRoomMap.get(user.roomId)

    if (user.type === USER_TYPE.ER) {
        res.send(room.finishInterview(loginUser))
    } else {
        res.send('您不是面试官，无权结束面试')
    }
})

// 获取前面还有多少人
app.get("/getRemain", (req, res) => {
    const loginUser = req.loginUser
    if (!userMap.has(loginUser)) {
        return res.send('您还没有加入房间，查询无效')
    }
    const user = userMap.get(loginUser)
    const room = idRoomMap.get(user.roomId);
    res.send(room.getRemain(user.type === USER_TYPE.ER? '':loginUser))
})

app.listen(3000, ()=>{
    console.log('面试系统启动成功!')
})

// 用户状态枚举
enum USER_STATUS  {
    // 在面试中
    IN_PROGRESS,
    // 空闲等待
    IDLE
}
// 用户类型枚举
enum USER_TYPE  {
    // 面试官
    ER,
    // 求职者
    EE
}
// 房间核心类
class Room {
    constructor(roomId) {
        this.roomId = roomId;
    }
    // 房间号
    roomId = -1;
    // 面试官队列
    interviewerQueue = [];
    // 求职者队列
    intervieweeQueue = [];

    // 面试官加入房间
    interviewerEnroll (interviewer) {

            const interviewee= this.intervieweeQueue.shift();
            // 当前有空闲求职者，直接开始面试
            if(interviewee){
                userMap.set(interviewee,{
                    status: USER_STATUS.IN_PROGRESS,
                    peer: interviewer,
                    type: USER_TYPE.EE,
                    roomId: this.roomId
                });
                userMap.set(interviewer,{
                    status: USER_STATUS.IN_PROGRESS,
                    peer: interviewee,
                    type: USER_TYPE.ER,
                    roomId: this.roomId
                });
                return interviewer+"开始面"+interviewee;
            } else {
                // 当前无空闲求职者，进入队列等待
                userMap.set(interviewer,{
                    status: USER_STATUS.IDLE,
                    type: USER_TYPE.ER,
                    roomId: this.roomId
                });
                this.interviewerQueue.push(interviewer);
                return '当前无排队求职者，请等待求职者到来'
            }

    }
    // 面试官退出房间
    interviewerExit (interviewer) {
        // 当前在面试中
        if(userMap.get(interviewer).status === USER_STATUS.IN_PROGRESS){
            return '正在面试，不能退出房间'
        } else {
            // 当前不在面试中，直接退队
            this.interviewerQueue.splice(this.interviewerQueue.indexOf(interviewer),1)
            userMap.delete(interviewer);
            return '退出成功'
        }
    }
    // 求职者加入房间
    intervieweeEnroll(interviewee){

            const interviewer = this.interviewerQueue.shift();
            // 当前有空闲面试官，直接开始面试
            if(interviewer){
                userMap.set(interviewee,{
                    status: USER_STATUS.IN_PROGRESS,
                    peer: interviewer,
                    type: USER_TYPE.EE,
                    roomId: this.roomId
                });
                userMap.set(interviewer,{
                    status: USER_STATUS.IN_PROGRESS,
                    peer: interviewee,
                    type: USER_TYPE.ER,
                    roomId: this.roomId
                });
                return interviewer+"开始面"+interviewee;
            } else {
                // 当前无空闲面试官，进入队列等待
                userMap.set(interviewee,{
                    status: USER_STATUS.IDLE,
                    type: USER_TYPE.EE,
                    roomId: this.roomId
                });
                this.intervieweeQueue.push(interviewee);
                return '当前无空闲面试官，请耐心等待其他人面试结束'
            }

    }
    // 求职者退出房间
    intervieweeExit (interviewee) {
        // 当前在面试中
        if(userMap.get(interviewee).status === USER_STATUS.IN_PROGRESS){
            return '正在面试, 不能退出房间'
        } else {
            // 当前不在面试中，直接退队
            userMap.delete(interviewee);
            this.intervieweeQueue.splice(this.intervieweeQueue.indexOf(interviewee),1)
            return '退出成功'
        }
    }
    // 面试官结束面试
    finishInterview(interviewer) {

            // 当前在面试中，结束面试
            if(userMap.get(interviewer).status === USER_STATUS.IN_PROGRESS){
                const peer = userMap.get(interviewer).peer
                userMap.delete(peer);
                userMap.delete(interviewer);
                return this.interviewerEnroll(interviewer)
            } else {
                // 当前不在面试中
                return '当前未在面试, 无法结束面试'
            }
            return '退出成功'

    }
    // 获取前面还有多少人在排队 / 还有多少人未面试
    getRemain(interviewee) {
        if (interviewee) {
            return this.intervieweeQueue.indexOf(interviewee)
        }
        return this.intervieweeQueue.length
    }

}
