var express = require('express');
var bodyParser = require('body-parser');
var _ = require('underscore');
var db = require('./db.js');
var bcrypt = require('bcrypt');
var middleware = require('./middleware.js')(db);

const { query } = require('express');
const { user, token } = require('./db.js');
var app = express();
var PORT = process.env.PORT || 3000;
var todos = [];
var todoNextId = 1;



app.use(bodyParser.json());

app.get('/',function (req, res){
    res.send('Todo API root');
});

app.get('/todos', middleware.requireAuthentication, function(req, res){
    var query = req.query;
    var where = {
        userId: req.user.get('id')
    };
    if (query.hasOwnProperty('completed') && query.completed === 'true') {
        where.completed = true;        
    } else if (query.hasOwnProperty('completed') && query.completed === 'false') {
        where.completed = false;        
    }

    if (query.hasOwnProperty('q') && query.q.length > 0) {
        where.description = {
            $like: '%' + query.q + '%'
        };        
    }
    db.todo.findAll({where: where}).then(function(todos){
        res.json(todos);
    },function(e){
        res.status(500).send();
    });
    // var filteredTodos = todos;
    // if (queryParams.hasOwnProperty('completed') && queryParams.completed === 'True') {
    //     filteredTodos = _.where(filteredTodos, {completed: true});        
    // } else if (queryParams.hasOwnProperty('completed') && queryParams.completed === 'false') {
    //     filteredTodos = _.where(filteredTodos, {completed: false});        
    // }
    // if (queryParams.hasOwnProperty('q') && queryParams.q.length > 0) {
    //     filteredTodos = _.filter(filteredTodos, function(todo){
    //         return todo.description.toLowerCase().indexOf(queryParams.q.toLowerCase()) > -1;
    //     });
    // }
    // res.json(filteredTodos);
});

app.get('/todos/:id',middleware.requireAuthentication,function(req, res){
    var todoId = parseInt(req.params.id, 10);

    db.todo.findOne({
        where: {
            id: todoId,
            userId: req.user.get('id')
        }
    }).then(function (todo){
        if (!!todo) {
            res.json(todo.toJSON());
        } else{
            res.status(404).send();
        }
    },function(e){
        res.status(500).send();
    });


    // var matchedTodo = _.findWhere(todos, {id: todoId});
    
    // if (matchedTodo) {
    //     res.json(matchedTodo);
    // }else{
    //    res.status(404).send();
    // }
   // res.send('Asking for todo with id of ' + req.params.id);
});

app.post('/todos',middleware.requireAuthentication, function(req, res){
    var body = _.pick(req.body, 'description', 'completed');
    db.todo.create(body).then(function(todo){
        req.user.addTodo(todo).then(function(){
            return todo.reload();
        }).then(function (todo){
            res.json(todo.toJSON());
        });
    }, function(e){
        res.status(400).json(e);
    });




    // if(!_.isBoolean(body.completed) || !_.isString(body.description) || body.description.trim().length === 0){
    //     return res.status(400).send();
    // };
    // body.description = body.description.trim();
    // body.id = todoNextId++;
    // todos.push(body);
    // // console.log('description: ' + body.description);
    // res.json(body);
});

app.delete('/todos/:id',middleware.requireAuthentication, function(req, res){
    var todoId = parseInt(req.params.id, 10);

    db.todo.destroy({
        where: {
            id: todoId,
            userId: req.user.get('id')
        }
    }).then(function(rowsDeleted){
        if (rowsDeleted === 0 ) {
            res.status(400).json({
                error: 'No todo with id'
            });
        } else{
            res.status(204).send();
        }
    },function (){
        res.status(500).send();
    })

    // var matchedTodo = _.findWhere(todos,{id: todoId});
    // if(!matchedTodo){
    //     res.status(404).json({"error": "no todo found with that id"});
    // } else{
    //     todos = _.without(todos, matchedTodo);
    //     res.json(matchedTodo);
    // }
});

app.put('/todos/:id',middleware.requireAuthentication, function(req, res){
    var todoId = parseInt(req.params.id, 10);
    var matchedTodo = _.findWhere(todos,{id: todoId});
    var body = _.pick(req.body, 'description', 'completed');
    var attributes = {};

    if(body.hasOwnProperty('completed')){
        attributes.completed = body.completed;
    } 

    if (body.hasOwnProperty('description')) {
        attributes.description = body.description;        
    } 

    db.todo.findOne({
        where: {
            id: todoId,
            userId: req.user.get('id')
        }
    }).then(function (todo){
        if (todo) {
            todo.update(attributes).then(function (todo){
                res.json(todo.toJSON());
            },function (e) {
                res.status(400).json(e);
            });
        } else {
            res.status(404).send();
        }
    }, function(){
        res.status(500).send();
    });
});

app.post('/users', function(req, res){
    var body = _.pick(req.body, 'email', 'password');
    db.user.create(body).then(function(user){
        res.json(user.toPublicJSON());
    }, function(e){
        res.status(400).json(e);
    });
});

// POST /users/login
app.post('/users/login', function (req, res){
    var body = _.pick(req.body, 'email', 'password');
    var userInstance;

    db.user.authenticate(body).then(function(user){
        var token = user.generateToken('authentication');
        userInstance = user;
        return db.token.create({
            token: token
        });
        
        // if (token) {
        //     res.header('Auth', token).json(user.toPublicJSON());               
        // }
        // else{
        //     res.status(401).send();
        // }
    }).then(function(tokenInstance){
        res.header('Auth', tokenInstance.get('token')).json(userInstance.toPublicJSON());
    }).catch(function(){
        res.status(401).send();
    });
});


// DELETE users login

app.delete('/users/login', middleware.requireAuthentication, function(req, res){
    req.token.destroy().then(function(){
        res.status(204).send();
    }).catch(function(){
        res.status(500).send();
    });
});


db.sequelize.sync({force: true}).then(function() {
    app.listen(PORT, function(){
        console.log('Express listening on port' + PORT + ' !');
    });
});