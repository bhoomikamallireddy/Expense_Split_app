const express = require('express');
const app = express();
const userRoutes = require('./routes/users.routes');
const groupRoutes = require('./routes/groups.routes');
const expenseRoutes = require('./routes/expenses.routes'); 
const settlementRoutes = require('./routes/settlements.routes');

app.use(express.json()); // Allows the app to read JSON data
app.use('/users', userRoutes);
app.use('/groups', groupRoutes);
app.use('/groups', expenseRoutes);
app.use('/groups', settlementRoutes);
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Server is running on http://localhost:${PORT}`);
});



