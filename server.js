const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const path = require('path')
const mongo = require('mongodb')
const mongoose = require('mongoose')
const url = process.env.MONGOLAB_URI
const cors = require('cors')

var Schema = mongoose.Schema;

var exercisesSchema = new Schema({
    userId: String,
    description: String,
    duration: Number,
    date: {type: Date, default: Date.now}
});

var userSchema = new Schema({
    username: String,
    count: Number
});

var users = mongoose.model("users", userSchema);
var exercises = mongoose.model("exercises", exercisesSchema);

mongoose.connect(url, {
    keepAlive: true
});
var db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'));


app.use(cors())

app.use(bodyParser.urlencoded({
    extended: false
}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
});

app.get("/api/exercise/log", function(req, res) {
    var id = req.query.userId,
        from = new Date(req.query.from),
        to = new Date(req.query.to),
        limit = Number(req.query.limit),
        temp = [];

    if (id == undefined) {
        res.send({
            success: false,
            error: "Id not specified"
        });
        res.end();

        return;
    }





    var query = {
        "userId": id,
        date: {}
    },
        options = {},
        noFromTo = true;
    if (from != "Invalid Date") {
        query.date["$gte"] = from;
        noFromTo = false;
    }

    if (to != "Invalid Date") {
        query.date["$lte"] = to;
        noFromTo = false;
    }

    if (!isNaN(limit)) {
        options.limit = limit;
    }
  
    if (noFromTo) {
        delete query.date;
    }

    exercises.find(query, "-__v -_id", options, function(err, user) {
        if (err != undefined) {
            throw err;
        }
        if (user == null) {
            res.send({
                success: false,
                error: "Id not found in database."
            });
        } else {
            res.send(user);
        }
        res.end();

        return;
    })
});

app.get("/api/exercise/users", function(req, res) {




    users.find({}, "-__v", function(err, data) {
        if (err != undefined) {
            throw err;
        }
        res.send(data);
        res.end();

        return;
    })
});

app.post("/api/exercise/new-user", function(req, res) {
    var username = req.body.username;

    if (username != undefined) {




        function insert() {
            var user = new users({
                "username": username,
                count: 0
            }).save(function(err) {
                if (err != undefined) {
                    throw err;
                }
                users.findOne({
                    "username": username
                }, "-count -__v" , function(err, user) {
                    if (err != undefined) {
                        throw err;
                    }
                    res.send(user);
                });
            })
        }

        users.findOne({
            "username": username
        }, function(err, user) {
            if (err != undefined) {
                throw err;
            }
            if (user != null) {
                res.send({
                    success: false,
                    error: "Username already exists."
                })
            } else {
                insert();
            }
        })
    } else {
        res.send({
            success: false,
            error: "Username not defined."
        });
        res.end();

        return;
    }
});

app.post("/api/exercise/add", function(req, res) {
    var id = req.body.userId,
        description = req.body.description,
        duration = req.body.duration,
        date = new Date(req.body.date);

    if (id == '') {
        res.send({
            success: false,
            error: "Id not defined."
        });
        res.end();

        return;
    } else if (description == '') {
        res.send({
            success: false,
            error: "Description not defined."
        });
        res.end();

        return;
    } else if (duration == '') {
        res.send({
            success: false,
            error: "Duration not defined."
        });
        res.end();

        return;
    } else if (date == "Invalid Date") {
        date = new Date();
    }

    users.findOne({
        "_id": id
    }, "-__v", function(err, data) {
        if (err != undefined) {
            throw err;
        }
        if (data != null) {
            var exercise = new exercises({
                userId: data["_id"],
                description: description,
                duration: duration,
                date: date
            }).save(function(err) {

                if (err != undefined) {

                    console.log(err.message);

                    res.send({
                        success: false,
                        error: "Apologies, something went wrong when we were adding your exercise."
                    });

                    res.end();

                } else {

                    res.send({
                        _id: id,
                        username: data.username,
                        description: description,
                        duration: duration,
                        date: date
                    });
              
                    res.end();

                }
            });
            data.count++;
            data.save();
        } else {
            res.send({
                success: false,
                error: "Id not found."
            });
            res.end();

            return;
        }
    })
})

//Not Found middleware
app.use((req, res, next) => {
    return next({
        status: 404,
        message: 'not found'
    })
})

// Error Handling middleware
app.use((err, req, res, next) => {
    let errCode, errMessage

    if (err.errors) {
        // mongoose validation error
        errCode = 400 // bad request
        const keys = Object.keys(err.errors)
        // report the first validation error
        errMessage = err.errors[keys[0]].message
    } else {
        // generic or custom error
        errCode = err.status || 500
        errMessage = err.message || 'Internal Server Error'
    }
    res.status(errCode).type('txt')
        .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
})